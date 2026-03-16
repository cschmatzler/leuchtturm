import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import * as schema from "@roasted/core/auth/auth.sql";
import { autumn } from "@roasted/core/billing/autumn";
import { db } from "@roasted/core/drizzle/index";
import { PREFIXES, createId, type IdPrefix } from "@roasted/core/id";
import { resend } from "@roasted/email/index";
import { renderPasswordResetEmail } from "@roasted/email/password-reset";

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
				from: "Sixth Coffee <no-reply@sixth.coffee>",
				to: user.email,
				subject: "Reset your Sixth Coffee password",
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
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},
	advanced: {
		database: {
			generateId: ({ model }) => {
				if (!(model in PREFIXES)) throw new Error(`Unknown auth model: ${model}`);
				return createId(model as IdPrefix);
			},
		},
	},
	userHooks: {
		afterCreate: async ({ user }: { user: { id: string; name: string; email: string } }) => {
			await autumn.customers.getOrCreate({
				customerId: user.id,
				name: user.name,
				email: user.email,
			});
		},
		afterUpdate: async ({
			user,
		}: {
			user: { id: string; name: string; email: string } | undefined;
		}) => {
			if (!user) return;
			await autumn.customers.update({
				customerId: user.id,
				name: user.name,
				email: user.email,
			});
		},
	},
});
