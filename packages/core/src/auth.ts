import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession, organization as organizationPlugin } from "better-auth/plugins";
import { Cause, Effect, Layer, Schema, Context } from "effect";
import { Resource } from "sst";
import { ulid } from "ulid";

import {
	account,
	invitation,
	member,
	organization,
	session,
	team,
	teamMember,
	user,
	verification,
} from "@leuchtturm/core/auth/auth.sql";
import {
	AuthDeviceSessionsListError,
	AuthError,
	AuthInvalidOrganizationPayloadError,
	AuthInvalidSessionPayloadError,
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
	Slug,
	TeamId,
	TeamMemberId,
	UserId,
	VerificationId,
} from "@leuchtturm/core/auth/schema";
import { Billing } from "@leuchtturm/core/billing";
import { Database } from "@leuchtturm/core/drizzle";
import { Email } from "@leuchtturm/core/email";
import { sendPasswordResetEmail } from "@leuchtturm/email/password-reset";

function slugify(value: string) {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	if (!slug) return "team";
	if (slug.length < 4) return `${slug}-team`;
	return slug;
}

async function uniqueTeamSlug(
	rawDatabase: Database.RawDatabase,
	organizationId: string,
	value: string,
) {
	const baseSlug = slugify(value);
	const { rows } = await rawDatabase.$client.query<{ slug: string }>(
		`select slug from "team" where organization_id = $1 and (slug = $2 or slug like $3)`,
		[organizationId, baseSlug, `${baseSlug}-%`],
	);
	const existingSlugs = new Set(rows.map((row) => row.slug));
	if (!existingSlugs.has(baseSlug)) return Schema.decodeSync(Slug)(baseSlug);

	for (let suffix = 2; ; suffix++) {
		const candidate = `${baseSlug}-${suffix}`;
		if (!existingSlugs.has(candidate)) return Schema.decodeSync(Slug)(candidate);
	}
}

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
			const { rawDatabase } = yield* Database.Service;
			const billing = yield* Billing.Service;
			const email = yield* Email.Service;

			const auth = betterAuth({
				baseURL: `${Resource.ApiConfig.BASE_URL}/api/auth`,
				secret: Resource.BetterAuthSecret.value,
				trustedOrigins: [Resource.ApiConfig.BASE_URL],
				database: drizzleAdapter(rawDatabase, {
					provider: "pg",
					schema: {
						account,
						session,
						user,
						verification,
						organization,
						member,
						invitation,
						team,
						teamMember,
					},
				}),
				emailAndPassword: {
					enabled: true,
					minPasswordLength: 13,
					sendResetPassword: ({ user, url }, _request) =>
						Effect.runPromise(
							Effect.tryPromise({
								try: () =>
									sendPasswordResetEmail({
										email: user.email,
										resetUrl: url,
										send: (emailParams) => Effect.runPromise(email.send(emailParams)),
										userName: user.name,
									}),
								catch: (cause) => cause,
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
							beforeCreateTeam: async ({ team }) => ({
								data: {
									...team,
									slug: await uniqueTeamSlug(
										rawDatabase,
										team.organizationId,
										typeof team.slug === "string" ? team.slug : team.name,
									),
								},
							}),
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
								if (!organization) return Promise.resolve();
								return Effect.runPromise(
									billing.updateCustomer({
										organizationId: organization.id,
										name: organization.name,
										slug: organization.slug,
									}),
								);
							},
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
				const currentSession = yield* Effect.tryPromise({
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
				);

				if (!currentSession) {
					return null;
				}

				return yield* Schema.decodeUnknownEffect(SessionData)(currentSession).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new AuthInvalidSessionPayloadError({ message: "Invalid auth session payload" }),
							);
						}),
					),
				);
			});

			const getOrganization = Effect.fn("Auth.getOrganization")(function* (
				headers: Headers,
				organizationId: string,
			) {
				const selectedOrganization = yield* Effect.tryPromise({
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
				);

				if (!selectedOrganization) return null;

				return yield* Schema.decodeUnknownEffect(
					Organization.mapFields(({ id, name, slug }) => ({ id, name, slug })),
				)(selectedOrganization).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new AuthInvalidOrganizationPayloadError({
									message: "Invalid auth organization payload",
								}),
							);
						}),
					),
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
