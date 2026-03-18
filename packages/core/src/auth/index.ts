import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";

import * as schema from "@chevrotain/core/auth/auth.sql";
import { db } from "@chevrotain/core/drizzle/index";
import { PREFIXES, createId, type IdPrefix } from "@chevrotain/core/id";
import { resend } from "@chevrotain/email/index";
import { renderPasswordResetEmail } from "@chevrotain/email/password-reset";

const polarClient = new Polar({
	accessToken: process.env.POLAR_ACCESS_TOKEN,
	server: process.env.POLAR_SERVER === "production" ? "production" : "sandbox",
});

const polarWebhookSecret = process.env.POLAR_WEBHOOK_SECRET ?? "polar_webhook_secret_placeholder";

export const auth = betterAuth({
	baseURL: `${process.env.BASE_URL}/api/auth`,
	trustedOrigins: [process.env.BASE_URL!],
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
			clientId: process.env.GITHUB_CLIENT_ID!,
			clientSecret: process.env.GITHUB_CLIENT_SECRET,
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
							productId: "76bcdda5-ba1d-4706-8a5c-6433e62d792d",
							slug: "Chevrotain-Pro",
						},
					],
					successUrl: process.env.POLAR_SUCCESS_URL,
					returnUrl: `${process.env.BASE_URL}/app/settings/billing`,
					authenticatedUsersOnly: true,
				}),
				portal({
					returnUrl: `${process.env.BASE_URL}/app/settings/billing`,
				}),
				webhooks({
					secret: polarWebhookSecret,
					onPayload: async (_payload) => {
						return;
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
