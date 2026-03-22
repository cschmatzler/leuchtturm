import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";
import { Effect, Layer, ServiceMap } from "effect";

import * as schema from "@chevrotain/core/auth/auth.sql";
import { POLAR_PRO_PRODUCT_ID, POLAR_PRO_PRODUCT_SLUG } from "@chevrotain/core/billing/products";
import { makePolarWebhookHandlers } from "@chevrotain/core/billing/webhooks";
import { CoreAuthConfig, CoreBillingConfig } from "@chevrotain/core/config";
import { NodeDatabase, type NodeDatabaseClient } from "@chevrotain/core/drizzle/index";
import { EmailService, type EmailServiceShape } from "@chevrotain/core/email/service";
import { PREFIXES, createId, type IdPrefix } from "@chevrotain/core/id";
import { renderPasswordResetEmail } from "@chevrotain/email/password-reset";

function createAuthInstance(
	authConfig: {
		baseUrl: string;
		authBaseUrl: string;
		githubClientId: string;
		githubClientSecret: string;
	},
	billingConfig: { accessToken: string; successUrl: string; webhookSecret: string },
	db: NodeDatabaseClient,
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
			minPasswordLength: 12,
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
					if (!(model in PREFIXES)) throw new Error(`Unknown auth model: ${model}`);
					return createId(model as IdPrefix);
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
		const db = yield* NodeDatabase;
		const email = yield* EmailService;

		return createAuthInstance(authConfig, billingConfig, db, email);
	}),
);
