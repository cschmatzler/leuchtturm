import {
	inferAdditionalFields,
	adminClient,
	magicLinkClient,
	multiSessionClient,
	organizationClient,
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
		magicLinkClient(),
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
