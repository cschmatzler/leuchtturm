import { polar, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import {
	betterAuth,
	type Session as BetterAuthSession,
	type User as BetterAuthUser,
} from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession, organization as organizationPlugin } from "better-auth/plugins";
import { eq, inArray } from "drizzle-orm";
import { Effect, Layer, Schema, Context } from "effect";
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
import { AuthError } from "@leuchtturm/core/auth/errors";
import {
	AccountId,
	type DeviceSessionsResponse,
	DeviceSessionsResponse as DeviceSessionsResponseSchema,
	InvitationId,
	MemberId,
	OrganizationId,
	SessionData,
	SessionId,
	UserId,
	VerificationId,
	PASSWORD_MIN_LENGTH,
} from "@leuchtturm/core/auth/schema";
import { Billing } from "@leuchtturm/core/billing";
import { Database } from "@leuchtturm/core/drizzle";
import { Email } from "@leuchtturm/core/email";
import { sendPasswordResetEmail } from "@leuchtturm/email/password-reset";

type OrganizationSummary = {
	id: string;
	name: string;
	slug: string;
};

type RawDeviceSession = {
	session: BetterAuthSession & { activeOrganizationId?: string | null };
	user: BetterAuthUser;
};

type Membership = OrganizationSummary & {
	sessionId: string;
};

function transformDeviceSessions(
	deviceSessions: RawDeviceSession[],
	memberships: Membership[],
	currentSessionToken: string | null | undefined,
): DeviceSessionsResponse {
	if (!deviceSessions.length) return { sessions: [], organizations: [] };

	const sessionIds = deviceSessions.map((deviceSession) => deviceSession.session.id);
	const sessionIndexMap = new Map(sessionIds.map((id, index) => [id, index]));

	const sessions = deviceSessions.map((deviceSession) => ({
		...deviceSession,
		organizations: [] as OrganizationSummary[],
	}));

	for (const membership of memberships) {
		const index = sessionIndexMap.get(membership.sessionId);
		if (index !== undefined) {
			sessions[index].organizations.push({
				id: membership.id,
				name: membership.name,
				slug: membership.slug,
			});
		}
	}

	const byName = (left: { name: string }, right: { name: string }) =>
		left.name.localeCompare(right.name);

	for (const deviceSession of sessions) {
		deviceSession.organizations.sort(byName);
	}

	sessions.sort((left, right) => {
		const leftIsCurrent = left.session.token === currentSessionToken;
		const rightIsCurrent = right.session.token === currentSessionToken;

		if (leftIsCurrent !== rightIsCurrent) {
			return leftIsCurrent ? -1 : 1;
		}

		return left.user.email.localeCompare(right.user.email);
	});

	const seenOrganizationIds = new Set<string>();
	const organizations = sessions.flatMap((deviceSession) => {
		return deviceSession.organizations.flatMap((currentOrganization) => {
			if (seenOrganizationIds.has(currentOrganization.id)) return [];
			seenOrganizationIds.add(currentOrganization.id);

			return [
				{
					...currentOrganization,
					token: deviceSession.session.token,
				},
			];
		});
	});

	organizations.sort(byName);

	return Schema.decodeUnknownSync(DeviceSessionsResponseSchema)({
		sessions,
		organizations,
	});
}

export namespace Auth {
	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, AuthError>;
		readonly getSession: (headers: Headers) => Effect.Effect<SessionData | null, AuthError>;
		readonly getOrganization: (
			organizationId: string,
		) => Effect.Effect<OrganizationSummary | null, AuthError>;
		readonly getDeviceSessions: (
			headers: Headers,
		) => Effect.Effect<DeviceSessionsResponse, AuthError>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Auth") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const { db, rawDb } = yield* Database.Service;
			const billing = yield* Billing.Service;
			const email = yield* Email.Service;
			const services = yield* Effect.context();

			const runCallback = <A, E>(effect: Effect.Effect<A, E>) =>
				Effect.runPromiseWith(services)(effect);

			const logWebhook = Effect.fn("Auth.logWebhook")(function* (type: string) {
				yield* Effect.logInfo("Polar webhook received").pipe(Effect.annotateLogs("type", type));
			});

			const upsertCustomerState = Effect.fn("Auth.upsertCustomerState")(function* (payload: {
				data: Parameters<Billing.Interface["upsertCustomerState"]>[0];
			}) {
				yield* billing.upsertCustomerState(payload.data);
			});

			const upsertOrder = Effect.fn("Auth.upsertOrder")(function* (payload: {
				data: Parameters<Billing.Interface["upsertOrder"]>[0];
			}) {
				yield* billing.upsertOrder(payload.data);
			});

			const upsertSubscription = Effect.fn("Auth.upsertSubscription")(function* (payload: {
				data: Parameters<Billing.Interface["upsertSubscription"]>[0];
			}) {
				yield* billing.upsertSubscription(payload.data);
			});

			const createOrganizationCustomer = Effect.fn("Auth.createOrganizationCustomer")(
				function* (payload: {
					organization: { id: string; name: string; slug: string };
					user: { email: string; name: string };
				}) {
					yield* billing.createCustomer({
						organizationId: payload.organization.id,
						name: payload.organization.name,
						slug: payload.organization.slug,
						ownerEmail: payload.user.email,
						ownerName: payload.user.name,
					});
				},
			);

			const updateOrganizationCustomer = Effect.fn("Auth.updateOrganizationCustomer")(
				function* (payload: { organization: { id: string; name: string; slug: string } }) {
					yield* billing.updateCustomer({
						organizationId: payload.organization.id,
						name: payload.organization.name,
						slug: payload.organization.slug,
					});
				},
			);

			const sendResetPassword = Effect.fn("Auth.sendResetPassword")(function* (params: {
				readonly user: { readonly email: string; readonly name: string };
				readonly url: string;
			}) {
				yield* Effect.tryPromise({
					try: () =>
						sendPasswordResetEmail({
							email: params.user.email,
							resetUrl: params.url,
							send: (emailParams) => runCallback(email.send(emailParams)),
							userName: params.user.name,
						}),
					catch: (error) =>
						new AuthError({
							message: `Failed to send password reset email: ${String(error)}`,
						}),
				});
			});

			const polarClient = new Polar({
				accessToken: Resource.PolarAccessToken.value,
				server: Resource.ApiConfig.POLAR_SERVER as "production" | "sandbox",
			});
			const auth = betterAuth({
				baseURL: `${Resource.ApiConfig.BASE_URL}/api/auth`,
				secret: Resource.BetterAuthSecret.value,
				trustedOrigins: [Resource.ApiConfig.BASE_URL],
				database: drizzleAdapter(rawDb, {
					provider: "pg",
					schema: { account, session, user, verification, organization, member, invitation },
				}),
				emailAndPassword: {
					enabled: true,
					minPasswordLength: PASSWORD_MIN_LENGTH,
					sendResetPassword: ({ user, url }, _request) =>
						runCallback(sendResetPassword({ user, url })),
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
								runCallback(createOrganizationCustomer({ organization, user })),
							afterUpdateOrganization: ({ organization }) => {
								if (!organization) return Promise.resolve();
								return runCallback(updateOrganizationCustomer({ organization }));
							},
						},
					}),
					polar({
						client: polarClient,
						use: [
							webhooks({
								secret: Resource.PolarWebhookSecret.value,
								onPayload: (payload) => runCallback(logWebhook(payload.type)),
								onCustomerStateChanged: (payload) => runCallback(upsertCustomerState(payload)),
								onOrderCreated: (payload) => runCallback(upsertOrder(payload)),
								onOrderPaid: (payload) => runCallback(upsertOrder(payload)),
								onOrderRefunded: (payload) => runCallback(upsertOrder(payload)),
								onOrderUpdated: (payload) => runCallback(upsertOrder(payload)),
								onSubscriptionCreated: (payload) => runCallback(upsertSubscription(payload)),
								onSubscriptionUpdated: (payload) => runCallback(upsertSubscription(payload)),
								onSubscriptionActive: (payload) => runCallback(upsertSubscription(payload)),
								onSubscriptionCanceled: (payload) => runCallback(upsertSubscription(payload)),
								onSubscriptionRevoked: (payload) => runCallback(upsertSubscription(payload)),
								onSubscriptionUncanceled: (payload) => runCallback(upsertSubscription(payload)),
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
					catch: (error) =>
						new AuthError({
							message: `Auth handler failed: ${String(error)}`,
						}),
				});
			});

			const getSession = Effect.fn("Auth.getSession")(function* (headers: Headers) {
				const currentSession = yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers }),
					catch: (error) =>
						new AuthError({
							message: `Auth getSession failed: ${String(error)}`,
						}),
				});

				if (!currentSession) {
					return null;
				}

				return yield* Schema.decodeUnknownEffect(SessionData)(currentSession).pipe(
					Effect.mapError(
						(error) =>
							new AuthError({
								message: `Invalid auth session payload: ${error.message}`,
							}),
					),
				);
			});

			const getOrganization = Effect.fn("Auth.getOrganization")(function* (organizationId: string) {
				const rows = yield* db
					.select({
						id: organization.id,
						name: organization.name,
						slug: organization.slug,
					})
					.from(organization)
					.where(eq(organization.id, organizationId))
					.limit(1)
					.pipe(
						Effect.mapError(
							(error) =>
								new AuthError({
									message: `Auth organization lookup failed: ${error.message}`,
								}),
						),
					);

				return rows[0] ?? null;
			});

			const getDeviceSessions = Effect.fn("Auth.getDeviceSessions")(function* (headers: Headers) {
				const currentSession = yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers }),
					catch: (error) =>
						new AuthError({
							message: `Auth getSession failed while loading device sessions: ${String(error)}`,
						}),
				});

				const deviceSessions = yield* Effect.tryPromise({
					try: () => auth.api.listDeviceSessions({ headers }),
					catch: (error) =>
						new AuthError({
							message: `Auth listDeviceSessions failed: ${String(error)}`,
						}),
				});

				if (!deviceSessions.length) {
					return { sessions: [], organizations: [] } satisfies DeviceSessionsResponse;
				}

				const sessionIds = deviceSessions.map((deviceSession) => deviceSession.session.id);
				const memberships = yield* Effect.tryPromise({
					try: () =>
						rawDb
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
					catch: (error) =>
						new AuthError({
							message: `Auth device session organization lookup failed: ${String(error)}`,
						}),
				});

				return transformDeviceSessions(
					deviceSessions as RawDeviceSession[],
					memberships,
					currentSession?.session.token,
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
