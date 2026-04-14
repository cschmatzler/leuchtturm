import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";
import { Effect, Layer, Schema, ServiceMap } from "effect";
import { Resource } from "sst";
import { ulid } from "ulid";

import { account, session, user, verification } from "@leuchtturm/core/auth/auth.sql";
import { AuthError } from "@leuchtturm/core/auth/errors";
import {
	AccountId,
	PASSWORD_MIN_LENGTH,
	SessionData,
	SessionId,
	UserId,
	VerificationId,
} from "@leuchtturm/core/auth/schema";
import { Billing } from "@leuchtturm/core/billing";
import { POLAR_PRO_PRODUCT_ID, POLAR_PRO_PRODUCT_SLUG } from "@leuchtturm/core/billing/products";
import { Database } from "@leuchtturm/core/drizzle";
import { Email } from "@leuchtturm/core/email";
import { sendPasswordResetEmail } from "@leuchtturm/email/password-reset";

export namespace Auth {
	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, AuthError>;
		readonly getSession: (headers: Headers) => Effect.Effect<SessionData | null, AuthError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@leuchtturm/Auth") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const { db } = yield* Database.Service;
			const billing = yield* Billing.Service;
			const email = yield* Email.Service;
			const services = yield* Effect.services();

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
				trustedOrigins: [Resource.ApiConfig.BASE_URL, Resource.ApiConfig.BASE_URL],
				database: drizzleAdapter(db, {
					provider: "pg",
					schema: { account, session, user, verification },
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
					polar({
						client: polarClient,
						createCustomerOnSignUp: true,
						use: [
							checkout({
								products: [
									{
										productId: POLAR_PRO_PRODUCT_ID,
										slug: POLAR_PRO_PRODUCT_SLUG,
									},
								],
								successUrl: Resource.PolarSuccessUrl.value,
								returnUrl: `${Resource.ApiConfig.BASE_URL}/app/settings/billing`,
								authenticatedUsersOnly: true,
							}),
							portal({
								returnUrl: `${Resource.ApiConfig.BASE_URL}/app/settings/billing`,
							}),
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
									return AccountId.makeUnsafe(`acc_${ulid()}`);
								case "user":
									return UserId.makeUnsafe(`usr_${ulid()}`);
								case "session":
									return SessionId.makeUnsafe(`ses_${ulid()}`);
								case "verification":
									return VerificationId.makeUnsafe(`ver_${ulid()}`);
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
				const session = yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers }),
					catch: (error) =>
						new AuthError({
							message: `Auth getSession failed: ${String(error)}`,
						}),
				});

				if (!session) {
					return null;
				}

				return yield* Schema.decodeUnknownEffect(SessionData)(session).pipe(
					Effect.mapError(
						(error) =>
							new AuthError({
								message: `Invalid auth session payload: ${error.message}`,
							}),
					),
				);
			});

			return Service.of({ handle, getSession });
		}),
	);

	export const defaultLayer = Layer.provide(
		layer,
		Layer.mergeAll(Billing.defaultLayer, Email.defaultLayer),
	);
}
