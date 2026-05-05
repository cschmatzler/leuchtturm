import {
	inferAdditionalFields,
	adminClient,
	multiSessionClient,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const apiUrl = import.meta.env.PORTLESS_TAILSCALE_URL ?? import.meta.env.VITE_API_URL;

export const authClient = createAuthClient({
	baseURL: `${apiUrl}/api/auth`,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [
		adminClient(),
		multiSessionClient(),
		inferAdditionalFields({
			user: {
				language: {
					type: "string",
					required: false,
					defaultValue: "en",
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
