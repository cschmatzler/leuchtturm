import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession, organization as organizationPlugin } from "better-auth/plugins";
import { and, eq, ne } from "drizzle-orm";
import { Cause, Effect, Layer, Schema, Context } from "effect";
import { AsyncLocalStorage } from "node:async_hooks";
import { Resource } from "sst";
import { ulid } from "ulid";

import {
	accountTable,
	invitationTable,
	memberTable,
	organizationTable,
	sessionTable,
	teamTable,
	teamMemberTable,
	userTable,
	verificationTable,
} from "@leuchtturm/core/auth/auth.sql";
import {
	AuthDeviceSessionsListError,
	AuthDuplicateOrganizationNameError,
	AuthDuplicateTeamNameError,
	AuthInvitationEmailError,
	AuthError,
	AuthInvalidDeviceSessionsPayloadError,
	AuthInvalidSessionPayloadError,
	AuthInvalidOrganizationPayloadError,
	AuthOrganizationLookupError,
	AuthPasswordResetEmailError,
	AuthSessionLookupError,
} from "@leuchtturm/core/auth/errors";
import {
	AccountId,
	DeviceSessions,
	InvitationId,
	MemberId,
	OrganizationId,
	Organization,
	SessionData,
	SessionId,
	Team,
	TeamId,
	TeamMemberId,
	UserId,
	VerificationId,
} from "@leuchtturm/core/auth/schema";
import { Billing } from "@leuchtturm/core/billing";
import { Database } from "@leuchtturm/core/drizzle";
import { Email } from "@leuchtturm/email/service";
import { sendInvitationEmail } from "@leuchtturm/email/templates/invitation";
import { sendPasswordResetEmail } from "@leuchtturm/email/templates/password-reset";

export namespace Auth {
	export interface Interface {
		readonly client: { readonly handler: (request: Request) => Promise<Response> };
		readonly handle: (request: Request) => Effect.Effect<Response, unknown>;
		readonly getSession: (
			headers: Headers,
		) => Effect.Effect<typeof SessionData.Type | null, typeof AuthError.Type>;
		readonly getOrganization: (
			headers: Headers,
			organizationId: string,
		) => Effect.Effect<
			Pick<typeof Organization.Type, "id" | "name" | "slug"> | null,
			typeof AuthError.Type
		>;
		readonly getDeviceSessions: (
			headers: Headers,
		) => Effect.Effect<typeof DeviceSessions.Type, typeof AuthError.Type>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Auth") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const { database, rawDatabase } = yield* Database.Service;
			const billing = yield* Billing.Service;
			const email = yield* Email.Service;
			const authContext = new AsyncLocalStorage<Context.Context<never>>();

			const makeAuth = (runAuthEffect: <A, E>(effect: Effect.Effect<A, E>) => Promise<A>) =>
				betterAuth({
					baseURL: `https://${Resource.Dns.APP_DOMAIN}/api/auth`,
					secret: Resource.BetterAuthSecret.value,
					onAPIError: {
						throw: true,
					},
					database: drizzleAdapter(rawDatabase, {
						provider: "pg",
						schema: {
							account: accountTable,
							session: sessionTable,
							user: userTable,
							verification: verificationTable,
							organization: organizationTable,
							member: memberTable,
							invitation: invitationTable,
							team: teamTable,
							teamMember: teamMemberTable,
						},
					}),
					emailAndPassword: {
						enabled: true,
						minPasswordLength: 13,
						sendResetPassword: ({ user, url }, _request) =>
							runAuthEffect(
								sendPasswordResetEmail({
									email: user.email,
									resetUrl: url,
									userName: user.name,
									send: (params) => email.send(params),
								}).pipe(
									Effect.catchCause((cause) =>
										Effect.gen(function* () {
											yield* Effect.annotateCurrentSpan({
												"error.original_cause": Cause.pretty(cause),
											});
											return yield* Effect.fail(new AuthPasswordResetEmailError());
										}),
									),
								),
							),
					},
					user: {
						additionalFields: {
							language: {
								type: "string",
								required: false,
								default: "en",
							},
						},
					},
					socialProviders: {
						github: {
							clientId: Resource.GitHubClientId.value,
							clientSecret: Resource.GitHubClientSecret.value,
						},
					},
					plugins: [
						multiSession(),
						organizationPlugin({
							sendInvitationEmail: ({ email: invitedEmail, id, inviter, organization }) =>
								runAuthEffect(
									sendInvitationEmail({
										acceptUrl: `https://${Resource.Dns.APP_DOMAIN}/accept-invitation/${id}`,
										email: invitedEmail,
										inviterName: inviter.user.name,
										organizationName: organization.name,
										send: (params) => email.send(params),
									}).pipe(
										Effect.catchCause((cause) =>
											Effect.gen(function* () {
												yield* Effect.annotateCurrentSpan({
													"error.original_cause": Cause.pretty(cause),
												});
												return yield* Effect.fail(new AuthInvitationEmailError());
											}),
										),
									),
								),
							teams: {
								enabled: true,
								defaultTeam: {
									enabled: true,
								},
							},
							schema: {
								team: {
									additionalFields: {
										slug: {
											type: "string",
											required: true,
										},
									},
								},
							},
							organizationHooks: {
								beforeCreateOrganization: ({ organization }) =>
									runAuthEffect(
										Effect.gen(function* () {
											const organizationName = yield* Schema.decodeEffect(Organization.fields.name)(
												organization.name ?? "",
											);
											const existingOrganization = yield* database
												.select({ id: organizationTable.id })
												.from(organizationTable)
												.where(eq(organizationTable.slug, organizationName.toLowerCase()))
												.limit(1);

											if (existingOrganization.length > 0) {
												return yield* new AuthDuplicateOrganizationNameError();
											}

											return {
												data: {
													...organization,
													name: organizationName,
													slug: organizationName.toLowerCase(),
												},
											};
										}),
									),
								afterCreateOrganization: ({ organization, user }) =>
									runAuthEffect(
										billing.createCustomer({
											organizationId: organization.id,
											name: organization.name,
											slug: organization.slug,
											ownerEmail: user.email,
											ownerName: user.name,
										}),
									),
								beforeUpdateOrganization: ({ organization, member }) =>
									runAuthEffect(
										Effect.logInfo("Auth organization update requested").pipe(
											Effect.annotateLogs({
												organizationId: member.organizationId,
												updatedFields: Object.keys(organization).sort().join(","),
											}),
										),
									),
								afterUpdateOrganization: ({ organization }) => {
									const updatedOrganization = organization!;

									return runAuthEffect(
										Effect.gen(function* () {
											yield* Effect.logInfo("Auth organization updated").pipe(
												Effect.annotateLogs({ organizationId: updatedOrganization.id }),
											);

											return yield* billing.updateCustomer({
												organizationId: updatedOrganization.id,
												name: updatedOrganization.name,
												slug: updatedOrganization.slug,
											});
										}),
									);
								},
								beforeCreateTeam: ({ team, organization }) =>
									runAuthEffect(
										Effect.gen(function* () {
											const teamName = yield* Schema.decodeEffect(Team.fields.name)(team.name);
											const existingTeam = yield* database
												.select({ id: teamTable.id })
												.from(teamTable)
												.where(
													and(
														eq(teamTable.organizationId, organization.id),
														eq(teamTable.slug, teamName.toLowerCase()),
													),
												)
												.limit(1);

											if (existingTeam.length > 0) {
												return yield* new AuthDuplicateTeamNameError();
											}

											return {
												data: {
													...team,
													name: teamName,
													slug: teamName.toLowerCase(),
													organizationId: organization.id,
												},
											};
										}),
									),
								beforeUpdateTeam: ({ team, updates, organization }) =>
									runAuthEffect(
										Effect.gen(function* () {
											yield* Effect.logInfo("Auth team update requested").pipe(
												Effect.annotateLogs({
													teamId: team.id,
													organizationId: organization.id,
													updatedFields: Object.keys(updates).sort().join(","),
												}),
											);

											if (updates.name === undefined) {
												return { data: updates };
											}

											const teamName = yield* Schema.decodeEffect(Team.fields.name)(updates.name);
											const existingTeam = yield* database
												.select({ id: teamTable.id })
												.from(teamTable)
												.where(
													and(
														ne(teamTable.id, team.id),
														eq(teamTable.slug, teamName.toLowerCase()),
														eq(teamTable.organizationId, organization.id),
													),
												)
												.limit(1);

											if (existingTeam.length > 0) {
												return yield* new AuthDuplicateTeamNameError();
											}

											return {
												data: {
													...updates,
													name: teamName,
													slug: teamName.toLowerCase(),
												},
											};
										}),
									),
								afterUpdateTeam: ({ team, organization }) =>
									runAuthEffect(
										Effect.logInfo("Auth team updated").pipe(
											Effect.annotateLogs({
												teamId: team!.id,
												organizationId: organization.id,
											}),
										),
									),
							},
						}),
						billing.authPlugin,
					],
					session: {
						cookieCache: {
							enabled: true,
							maxAge: 5 * 60,
						},
					},
					advanced: {
						disableOriginCheck: true,
						...(Resource.App.stage !== "prod" && {
							defaultCookieAttributes: {
								sameSite: "none" as const,
								secure: true,
								partitioned: true,
							},
						}),
						crossSubDomainCookies: {
							enabled: true,
							domain: Resource.Dns.APP_DOMAIN,
						},
						database: {
							generateId: ({ model }) => {
								switch (model) {
									case "account":
										return Schema.decodeSync(AccountId)(`acc_${ulid()}`);
									case "user":
										return Schema.decodeSync(UserId)(`usr_${ulid()}`);
									case "session":
										return Schema.decodeSync(SessionId)(`ses_${ulid()}`);
									case "verification":
										return Schema.decodeSync(VerificationId)(`ver_${ulid()}`);
									case "organization":
										return Schema.decodeSync(OrganizationId)(`org_${ulid()}`);
									case "member":
										return Schema.decodeSync(MemberId)(`mem_${ulid()}`);
									case "invitation":
										return Schema.decodeSync(InvitationId)(`inv_${ulid()}`);
									case "team":
										return Schema.decodeSync(TeamId)(`tea_${ulid()}`);
									case "teamMember":
										return Schema.decodeSync(TeamMemberId)(`tmb_${ulid()}`);
									default:
										throw new Error(`Unknown auth model: ${model}`);
								}
							},
						},
					},
				});

			const auth = makeAuth((effect) =>
				Effect.runPromiseWith(authContext.getStore() ?? Context.empty())(effect),
			);

			const handle = Effect.fn("Auth.handle")(function* (request: Request) {
				const context = yield* Effect.context<never>();

				return yield* Effect.tryPromise({
					try: () => authContext.run(context, () => auth.handler(request)),
					catch: (cause) => cause,
				});
			});

			const getSession = Effect.fn("Auth.getSession")(function* (headers: Headers) {
				return yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers }),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(new AuthSessionLookupError());
						}),
					),
					Effect.flatMap((session) =>
						Schema.decodeUnknownEffect(SessionData)(session).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									return yield* Effect.fail(new AuthInvalidSessionPayloadError());
								}),
							),
						),
					),
				);
			});

			const getOrganization = Effect.fn("Auth.getOrganization")(function* (
				headers: Headers,
				organizationId: string,
			) {
				return yield* Effect.tryPromise({
					try: () =>
						auth.api.getFullOrganization({
							headers,
							query: { organizationId },
						}),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(new AuthOrganizationLookupError());
						}),
					),
					Effect.flatMap((organization) =>
						Schema.decodeUnknownEffect(Organization)(organization).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									return yield* Effect.fail(new AuthInvalidOrganizationPayloadError());
								}),
							),
						),
					),
					Effect.map(({ id, name, slug }) => ({ id, name, slug })),
				);
			});

			const getDeviceSessions = Effect.fn("Auth.getDeviceSessions")(function* (headers: Headers) {
				return yield* Effect.tryPromise({
					try: () => auth.api.listDeviceSessions({ headers }),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(new AuthDeviceSessionsListError());
						}),
					),
					Effect.flatMap((deviceSessions) =>
						Schema.decodeUnknownEffect(DeviceSessions)(deviceSessions).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									return yield* Effect.fail(new AuthInvalidDeviceSessionsPayloadError());
								}),
							),
						),
					),
				);
			});

			return Service.of({ client: auth, handle, getSession, getOrganization, getDeviceSessions });
		}),
	);

	export const defaultLayer = Layer.provide(
		layer,
		Layer.mergeAll(Billing.defaultLayer, Email.defaultLayer),
	);
}
