import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";
import { Effect, Layer, Schema, ServiceMap } from "effect";
import { ulid } from "ulid";

import * as schema from "@chevrotain/core/auth/auth.sql";
import {
	AccountId,
	JWKSId,
	PASSWORD_MIN_LENGTH,
	Session,
	SessionId,
	User,
	UserId,
	VerificationId,
} from "@chevrotain/core/auth/schema";
import { POLAR_PRO_PRODUCT_ID, POLAR_PRO_PRODUCT_SLUG } from "@chevrotain/core/billing/products";
import { makePolarWebhookHandlers } from "@chevrotain/core/billing/webhooks";
import { CoreAuthConfig, CoreBillingConfig } from "@chevrotain/core/config";
import { Database, type DatabaseClient } from "@chevrotain/core/drizzle";
import { Email } from "@chevrotain/core/email";
import { renderPasswordResetEmail } from "@chevrotain/email/password-reset";

type AuthHeaders = globalThis.Headers | Record<string, string>;

async function sendResetPasswordEmail(user: { name: string; email: string }, url: string) {
	const { html, text } = await renderPasswordResetEmail({
		resetUrl: url,
		userName: user.name,
	});

	await Email.send({
		from: "Chevrotain <no-reply@chevrotain.schmatzler.com>",
		to: user.email,
		subject: "Reset your Chevrotain password",
		html,
		text,
	}).catch((error) => {
		console.error("Failed to send password reset email", error);
		throw new Error("Failed to send password reset email");
	});
}

function createAuthInstance(
	authConfig: {
		baseUrl: string;
		authBaseUrl: string;
		githubClientId: string;
		githubClientSecret: string;
	},
	billingConfig: { accessToken: string; successUrl: string; webhookSecret: string },
	db: DatabaseClient,
) {
	const polarClient = new Polar({
		accessToken: billingConfig.accessToken,
		server: "sandbox",
	});
	const polarWebhookHandlers = makePolarWebhookHandlers(db);

	return betterAuth({
		baseURL: `${authConfig.authBaseUrl}/api/auth`,
		trustedOrigins: [authConfig.baseUrl, authConfig.authBaseUrl],
		database: drizzleAdapter(db, {
			provider: "pg",
			schema,
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: PASSWORD_MIN_LENGTH,
			sendResetPassword: async ({ user, url }, _request) => sendResetPasswordEmail(user, url),
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
				clientId: authConfig.githubClientId,
				clientSecret: authConfig.githubClientSecret,
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
						successUrl: billingConfig.successUrl,
						returnUrl: `${authConfig.baseUrl}/app/settings/billing`,
						authenticatedUsersOnly: true,
					}),
					portal({
						returnUrl: `${authConfig.baseUrl}/app/settings/billing`,
					}),
					webhooks({
						secret: billingConfig.webhookSecret,
						...polarWebhookHandlers,
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
				domain: ".chevrotain.schmatzler.com",
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
						case "jwks":
							return JWKSId.makeUnsafe(`jwk_${ulid()}`);
						default:
							throw new Error(`Unknown auth model: ${model}`);
					}
				},
			},
		},
	});
}

export namespace Auth {
	export interface SessionData {
		readonly user: User;
		readonly session: Session;
	}

	export class AuthError extends Schema.TaggedErrorClass<AuthError>()("AuthError", {
		message: Schema.String,
	}) {}

	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, AuthError>;
		readonly getSession: (headers: AuthHeaders) => Effect.Effect<SessionData | null, AuthError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Auth") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const authConfig = yield* CoreAuthConfig;
			const billingConfig = yield* CoreBillingConfig;
			const { db } = yield* Database.Service;
			const auth = createAuthInstance(authConfig, billingConfig, db);

			const decodeSessionData = (sessionData: { user: unknown; session: unknown }) =>
				Effect.all({
					user: Schema.decodeUnknownEffect(User)(sessionData.user),
					session: Schema.decodeUnknownEffect(Session)(sessionData.session),
				}).pipe(
					Effect.mapError(
						(error) =>
							new AuthError({
								message: `Invalid auth session payload: ${error.message}`,
							}),
					),
				);

			const handle = Effect.fn("Auth.handle")(function* (request: Request) {
				return yield* Effect.tryPromise({
					try: () => auth.handler(request),
					catch: (error) =>
						new AuthError({
							message: `Auth handler failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});
			});

			const getSession = Effect.fn("Auth.getSession")(function* (headers: AuthHeaders) {
				const session = yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers: new globalThis.Headers(headers) }),
					catch: (error) =>
						new AuthError({
							message: `Auth getSession failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				if (!session) {
					return null;
				}

				return yield* decodeSessionData({
					user: session.user,
					session: session.session,
				});
			});

			return Service.of({ handle, getSession });
		}),
	);

	export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer));
}
