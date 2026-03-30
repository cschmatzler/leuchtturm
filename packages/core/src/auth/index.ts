import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";
import { Effect, Layer, Redacted, Schema, ServiceMap } from "effect";
import { ulid } from "ulid";

import * as sql from "@chevrotain/core/auth/auth.sql";
import {
	AccountId,
	PASSWORD_MIN_LENGTH,
	Session,
	SessionId,
	User,
	UserId,
	VerificationId,
} from "@chevrotain/core/auth/schema";
import { POLAR_PRO_PRODUCT_ID, POLAR_PRO_PRODUCT_SLUG } from "@chevrotain/core/billing/products";
import {
	upsertPolarCustomerState,
	upsertPolarOrder,
	upsertPolarSubscription,
} from "@chevrotain/core/billing/queries";
import { CoreConfig } from "@chevrotain/core/config";
import { Database } from "@chevrotain/core/drizzle/index";
import { Email } from "@chevrotain/core/email";
import { sendPasswordResetEmail } from "@chevrotain/email/password-reset";

export namespace Auth {
	export const SessionData = Schema.Struct({
		user: User,
		session: Session,
	});

	export type SessionData = typeof SessionData.Type;

	export class AuthError extends Schema.TaggedErrorClass<AuthError>()("AuthError", {
		message: Schema.String,
	}) {}

	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, AuthError>;
		readonly getSession: (headers: Headers) => Effect.Effect<SessionData | null, AuthError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Auth") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const config = yield* CoreConfig;
			const { db } = yield* Database.Service;
			const polarClient = new Polar({
				accessToken: Redacted.value(config.billing.accessToken),
				server: config.billing.server,
			});
			const auth = betterAuth({
				baseURL: `${config.auth.authBaseUrl}/api/auth`,
				trustedOrigins: [config.baseUrl, config.auth.authBaseUrl],
				database: drizzleAdapter(db, {
					provider: "pg",
					schema: sql,
				}),
				emailAndPassword: {
					enabled: true,
					minPasswordLength: PASSWORD_MIN_LENGTH,
					sendResetPassword: async ({ user, url }, _request) =>
						sendPasswordResetEmail({
							email: user.email,
							resetUrl: url,
							send: Email.send,
							userName: user.name,
						}),
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
						clientId: config.auth.githubClientId,
						clientSecret: Redacted.value(config.auth.githubClientSecret),
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
								successUrl: config.billing.successUrl,
								returnUrl: `${config.baseUrl}/app/settings/billing`,
								authenticatedUsersOnly: true,
							}),
							portal({
								returnUrl: `${config.baseUrl}/app/settings/billing`,
							}),
							webhooks({
								secret: Redacted.value(config.billing.webhookSecret),
								onPayload: async (payload) => {
									console.info(`[polar.webhook] ${payload.type}`);
								},
								onCustomerStateChanged: async (payload) => {
									await upsertPolarCustomerState(db, payload.data);
								},
								onOrderCreated: async (payload) => {
									await upsertPolarOrder(db, polarClient, payload.data);
								},
								onOrderPaid: async (payload) => {
									await upsertPolarOrder(db, polarClient, payload.data);
								},
								onOrderRefunded: async (payload) => {
									await upsertPolarOrder(db, polarClient, payload.data);
								},
								onOrderUpdated: async (payload) => {
									await upsertPolarOrder(db, polarClient, payload.data);
								},
								onSubscriptionCreated: async (payload) => {
									await upsertPolarSubscription(db, polarClient, payload.data);
								},
								onSubscriptionUpdated: async (payload) => {
									await upsertPolarSubscription(db, polarClient, payload.data);
								},
								onSubscriptionActive: async (payload) => {
									await upsertPolarSubscription(db, polarClient, payload.data);
								},
								onSubscriptionCanceled: async (payload) => {
									await upsertPolarSubscription(db, polarClient, payload.data);
								},
								onSubscriptionRevoked: async (payload) => {
									await upsertPolarSubscription(db, polarClient, payload.data);
								},
								onSubscriptionUncanceled: async (payload) => {
									await upsertPolarSubscription(db, polarClient, payload.data);
								},
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
							message: `Auth handler failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});
			});

			const getSession = Effect.fn("Auth.getSession")(function* (headers: Headers) {
				const session = yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers }),
					catch: (error) =>
						new AuthError({
							message: `Auth getSession failed: ${error instanceof Error ? error.message : String(error)}`,
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

	export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer));
}
