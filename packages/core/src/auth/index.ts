import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";

import * as schema from "@chevrotain/core/auth/auth.sql";
import {
	polarClient,
	POLAR_SUCCESS_URL,
	POLAR_WEBHOOK_SECRET,
} from "@chevrotain/core/billing/polar";
import { POLAR_PRO_PRODUCT_ID, POLAR_PRO_PRODUCT_SLUG } from "@chevrotain/core/billing/products";
import { polarWebhookHandlers } from "@chevrotain/core/billing/webhooks";
import { coreAuthConfig } from "@chevrotain/core/config";
import { db } from "@chevrotain/core/drizzle/index";
import { PREFIXES, createId, type IdPrefix } from "@chevrotain/core/id";
import { resend } from "@chevrotain/email/index";
import { renderPasswordResetEmail } from "@chevrotain/email/password-reset";

export const auth = betterAuth({
	baseURL: `${coreAuthConfig.baseUrl}/api/auth`,
	trustedOrigins: [coreAuthConfig.baseUrl],
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

			await resend.emails.send({
				from: "Chevrotain <no-reply@chevrotain.schmatzler.com>",
				to: user.email,
				subject: "Reset your Chevrotain password",
				html,
				text,
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
			clientId: coreAuthConfig.githubClientId,
			clientSecret: coreAuthConfig.githubClientSecret,
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
					successUrl: POLAR_SUCCESS_URL,
					returnUrl: `${coreAuthConfig.baseUrl}/app/settings/billing`,
					authenticatedUsersOnly: true,
				}),
				portal({
					returnUrl: `${coreAuthConfig.baseUrl}/app/settings/billing`,
				}),
				webhooks({
					secret: POLAR_WEBHOOK_SECRET,
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
