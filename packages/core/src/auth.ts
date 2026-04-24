import { polar, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession, organization as organizationPlugin } from "better-auth/plugins";
import { eq, inArray } from "drizzle-orm";
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
	AuthDeviceSessionOrganizationLookupError,
	AuthDeviceSessionsListError,
	AuthError,
	AuthHandlerError,
	AuthInvalidDeviceSessionsPayloadError,
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
		readonly handle: (request: Request) => Effect.Effect<Response, typeof AuthError.Type>;
		readonly getSession: (
			headers: Headers,
		) => Effect.Effect<typeof SessionData.Type | null, typeof AuthError.Type>;
		readonly getOrganization: (
			organizationId: string,
		) => Effect.Effect<typeof OrganizationSummary.Type | null, typeof AuthError.Type>;
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
			const services = yield* Effect.context();

			const polarClient = new Polar({
				accessToken: Resource.PolarAccessToken.value,
				server: Resource.ApiConfig.POLAR_SERVER as "production" | "sandbox",
			});
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
						Effect.runPromiseWith(services)(
							Effect.tryPromise({
								try: () =>
									sendPasswordResetEmail({
										email: user.email,
										resetUrl: url,
										send: (emailParams) => Effect.runPromiseWith(services)(email.send(emailParams)),
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
								Effect.runPromiseWith(services)(
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
								return Effect.runPromiseWith(services)(
									billing.updateCustomer({
										organizationId: organization.id,
										name: organization.name,
										slug: organization.slug,
									}),
								);
							},
						},
					}),
					polar({
						client: polarClient,
						use: [
							webhooks({
								secret: Resource.PolarWebhookSecret.value,
								onPayload: (payload) =>
									Effect.runPromiseWith(services)(
										Effect.logInfo("Polar webhook received").pipe(
											Effect.annotateLogs("type", payload.type),
										),
									),
								onCustomerStateChanged: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertCustomerState(payload.data)),
								onOrderCreated: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertOrder(payload.data)),
								onOrderPaid: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertOrder(payload.data)),
								onOrderRefunded: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertOrder(payload.data)),
								onOrderUpdated: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertOrder(payload.data)),
								onSubscriptionCreated: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertSubscription(payload.data)),
								onSubscriptionUpdated: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertSubscription(payload.data)),
								onSubscriptionActive: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertSubscription(payload.data)),
								onSubscriptionCanceled: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertSubscription(payload.data)),
								onSubscriptionRevoked: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertSubscription(payload.data)),
								onSubscriptionUncanceled: (payload) =>
									Effect.runPromiseWith(services)(billing.upsertSubscription(payload.data)),
							}),
						],
					}),
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

			const handle = Effect.fn("Auth.handle")(function* (request: Request) {
				return yield* Effect.tryPromise({
					try: () => auth.handler(request),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(new AuthHandlerError({ message: "Auth handler failed" }));
						}),
					),
				);
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

			const getOrganization = Effect.fn("Auth.getOrganization")(function* (organizationId: string) {
				const rows = yield* database
					.select({
						id: organization.id,
						name: organization.name,
						slug: organization.slug,
					})
					.from(organization)
					.where(eq(organization.id, organizationId))
					.limit(1)
					.pipe(
						Effect.catchCause((cause) =>
							Effect.gen(function* () {
								yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
								return yield* Effect.fail(
									new AuthOrganizationLookupError({ message: "Auth organization lookup failed" }),
								);
							}),
						),
					);

				const selectedOrganization = rows[0];
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
				const currentSession = yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers }),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new AuthSessionLookupError({
									message: "Auth session lookup failed while loading device sessions",
								}),
							);
						}),
					),
				);

				const deviceSessions = yield* Effect.tryPromise({
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

				if (!deviceSessions.length) {
					return { sessions: [], organizations: [] } satisfies typeof DeviceSessions.Type;
				}

				const sessionIds = deviceSessions.map((deviceSession) => deviceSession.session.id);
				const memberships = yield* Effect.tryPromise({
					try: () =>
						rawDatabase
							.select({
								sessionId: session.id,
								id: organization.id,
								name: organization.name,
								slug: organization.slug,
							})
							.from(session)
							.innerJoin(member, eq(member.userId, session.userId))
							.innerJoin(organization, eq(member.organizationId, organization.id))
							.where(inArray(session.id, sessionIds)),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new AuthDeviceSessionOrganizationLookupError({
									message: "Auth device session organization lookup failed",
								}),
							);
						}),
					),
				);

				const sessions = deviceSessions
					.map((deviceSession) => ({
						...deviceSession,
						organizations: memberships
							.filter((membership) => membership.sessionId === deviceSession.session.id)
							.map((membership) => ({
								id: membership.id,
								name: membership.name,
								slug: membership.slug,
							}))
							.sort((left, right) => left.name.localeCompare(right.name)),
					}))
					.sort((left, right) => {
						const leftIsCurrent = left.session.token === currentSession?.session.token;
						const rightIsCurrent = right.session.token === currentSession?.session.token;

						if (leftIsCurrent !== rightIsCurrent) {
							return leftIsCurrent ? -1 : 1;
						}

						return left.user.email.localeCompare(right.user.email);
					});

				const seenOrganizationIds = new Set<string>();
				const organizations = sessions
					.flatMap((deviceSession) =>
						deviceSession.organizations.flatMap((currentOrganization) => {
							if (seenOrganizationIds.has(currentOrganization.id)) return [];
							seenOrganizationIds.add(currentOrganization.id);

							return [
								{
									...currentOrganization,
									token: deviceSession.session.token,
								},
							];
						}),
					)
					.sort((left, right) => left.name.localeCompare(right.name));

				return yield* Schema.decodeUnknownEffect(DeviceSessions)({
					sessions,
					organizations,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new AuthInvalidDeviceSessionsPayloadError({
									message: "Invalid auth device sessions payload",
								}),
							);
						}),
					),
				);
			});

			return Service.of({ handle, getSession, getOrganization, getDeviceSessions });
		}),
	);

	export const defaultLayer = Layer.provide(
		layer,
		Layer.mergeAll(Billing.defaultLayer, Email.defaultLayer),
	);
}
