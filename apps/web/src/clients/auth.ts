import {
	inferAdditionalFields,
	multiSessionClient,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: `${location.origin}/api/auth`,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [
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
