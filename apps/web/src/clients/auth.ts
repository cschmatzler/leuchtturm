import {
	inferAdditionalFields,
	adminClient,
	multiSessionClient,
	organizationClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: `${import.meta.env.VITE_API_URL}/auth`,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [
		adminClient(),
		multiSessionClient(),
		twoFactorClient({ twoFactorPage: "/two-factor" }),
		inferAdditionalFields({
			user: {
				language: {
					type: "string",
					required: false,
					defaultValue: "en",
				},
				twoFactorEnabled: {
					type: "boolean",
					required: false,
					defaultValue: false,
				},
			},
		}),
		organizationClient({
			teams: { enabled: true },
			schema: {
				team: {
					additionalFields: {
						slug: {
							type: "string",
							required: true,
						},
					},
				},
			},
		}),
	],
});
