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
	OrganizationSummary,
	SessionData,
	SessionId,
	UserId,
	VerificationId,
} from "@leuchtturm/core/auth/schema";
import { Billing } from "@leuchtturm/core/billing";
import { Database } from "@leuchtturm/core/drizzle";
import { Email } from "@leuchtturm/core/email";
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
		) => Effect.Effect<typeof OrganizationSummary.Type | null, typeof AuthError.Type>;
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
					schema: { account, session, user, verification, organization, member, invitation },
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

				return yield* Schema.decodeUnknownEffect(OrganizationSummary)(selectedOrganization).pipe(
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
