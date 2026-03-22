import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";
import { Effect, Layer, ServiceMap } from "effect";
import { ulid } from "ulid";

import * as schema from "@chevrotain/core/auth/auth.sql";
import {
	AccountId,
	JWKSId,
	PASSWORD_MIN_LENGTH,
	SessionId,
	UserId,
	VerificationId,
} from "@chevrotain/core/auth/schema";
import { POLAR_PRO_PRODUCT_ID, POLAR_PRO_PRODUCT_SLUG } from "@chevrotain/core/billing/products";
import { makePolarWebhookHandlers } from "@chevrotain/core/billing/webhooks";
import { CoreAuthConfig, CoreBillingConfig } from "@chevrotain/core/config";
import { DatabaseService, type DatabaseClient } from "@chevrotain/core/drizzle/service";
import { EmailService, type EmailServiceShape } from "@chevrotain/core/email/service";
import { renderPasswordResetEmail } from "@chevrotain/email/password-reset";

function createAuthInstance(
	authConfig: {
		baseUrl: string;
		authBaseUrl: string;
		githubClientId: string;
		githubClientSecret: string;
	},
	billingConfig: { accessToken: string; successUrl: string; webhookSecret: string },
	db: DatabaseClient,
	email: EmailServiceShape,
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
			sendResetPassword: async ({ user, url }, _request) => {
				const { html, text } = await renderPasswordResetEmail({
					resetUrl: url,
					userName: user.name,
				});

				await Effect.runPromise(
					email.send({
						from: "Chevrotain <no-reply@chevrotain.schmatzler.com>",
						to: user.email,
						subject: "Reset your Chevrotain password",
						html,
						text,
					}),
				).catch((error) => {
					console.error("Failed to send password reset email", error);
					throw new Error("Failed to send password reset email");
				});
			},
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

export type Auth = ReturnType<typeof createAuthInstance>;

export class AuthService extends ServiceMap.Service<AuthService, Auth>()("AuthService") {}

export const AuthServiceLive = Layer.effect(AuthService)(
	Effect.gen(function* () {
		const authConfig = yield* CoreAuthConfig;
		const billingConfig = yield* CoreBillingConfig;
		const db = yield* DatabaseService;
		const email = yield* EmailService;

		return createAuthInstance(authConfig, billingConfig, db, email);
	}),
);
