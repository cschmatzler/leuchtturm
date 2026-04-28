import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession, organization as organizationPlugin } from "better-auth/plugins";
import { and, eq, ne } from "drizzle-orm";
import { Cause, Effect, Layer, Schema, Context } from "effect";
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
	AuthDuplicateTeamNameError,
	AuthInvitationEmailError,
	AuthError,
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
import { Email } from "@leuchtturm/core/email";
import { sendInvitationEmail } from "@leuchtturm/email/invitation";
import { sendPasswordResetEmail } from "@leuchtturm/email/password-reset";

export namespace Auth {
	export interface Interface {
		readonly client: { readonly handler: (request: Request) => Promise<Response> };
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

			const auth = betterAuth({
				baseURL: `${Resource.ApiConfig.BASE_URL}/api/auth`,
				secret: Resource.BetterAuthSecret.value,
				trustedOrigins: [Resource.ApiConfig.BASE_URL],
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
						Effect.runPromise(
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
										return yield* Effect.fail(
											new AuthPasswordResetEmailError({
												message: "Failed to send password reset email",
											}),
										);
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
							Effect.runPromise(
								sendInvitationEmail({
									acceptUrl: `${Resource.ApiConfig.BASE_URL}/accept-invitation?id=${id}`,
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
											return yield* Effect.fail(
												new AuthInvitationEmailError({
													message: "Failed to send invitation email",
												}),
											);
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
							afterCreateOrganization: ({ organization, user }) =>
								Effect.runPromise(
									billing.createCustomer({
										organizationId: organization.id,
										name: organization.name,
										slug: organization.slug,
										ownerEmail: user.email,
										ownerName: user.name,
									}),
								),
							afterUpdateOrganization: ({ organization }) => {
								return Effect.runPromise(
									billing.updateCustomer({
										organizationId: organization!.id,
										name: organization!.name,
										slug: organization!.slug,
									}),
								);
							},
							beforeCreateTeam: ({ team, organization }) =>
								Effect.runPromise(
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
											return yield* new AuthDuplicateTeamNameError({
												message: "Team name already exists",
											});
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
								Effect.runPromise(
									Effect.gen(function* () {
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
											return yield* new AuthDuplicateTeamNameError({
												message: "Team name already exists",
											});
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
					crossSubDomainCookies: {
						enabled: true,
						domain: new URL(Resource.ApiConfig.BASE_URL).hostname,
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

			const getSession = Effect.fn("Auth.getSession")(function* (headers: Headers) {
				return yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers }),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new AuthSessionLookupError({ message: "Auth session lookup failed" }),
							);
						}),
					),
					Effect.flatMap((session) =>
						Schema.decodeUnknownEffect(SessionData)(session).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									return yield* Effect.fail(
										new AuthInvalidSessionPayloadError({
											message: "Invalid auth session payload",
										}),
									);
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
							return yield* Effect.fail(
								new AuthOrganizationLookupError({ message: "Auth organization lookup failed" }),
							);
						}),
					),
					Effect.flatMap((organization) =>
						Schema.decodeUnknownEffect(Organization)(organization).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									return yield* Effect.fail(
										new AuthInvalidOrganizationPayloadError({
											message: "Invalid auth organization payload",
										}),
									);
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
							return yield* Effect.fail(
								new AuthDeviceSessionsListError({ message: "Auth device session list failed" }),
							);
						}),
					),
					Effect.flatMap((deviceSessions) =>
						Schema.decodeUnknownEffect(DeviceSessions)(deviceSessions).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									return yield* Effect.fail(
										new AuthInvalidSessionPayloadError({
											message: "Invalid auth device sessions payload",
										}),
									);
								}),
							),
						),
					),
				);
			});

			return Service.of({ client: auth, getSession, getOrganization, getDeviceSessions });
		}),
	);

	export const defaultLayer = Layer.provide(
		layer,
		Layer.mergeAll(Billing.defaultLayer, Email.defaultLayer),
	);
}
