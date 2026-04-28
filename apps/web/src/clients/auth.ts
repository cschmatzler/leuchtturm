import type { BetterAuthClientPlugin } from "better-auth/client";
import { multiSessionClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const userAdditionalFieldsClient = {
	id: "user-additional-fields",
	$InferServerPlugin: {
		id: "user-additional-fields",
		schema: {
			user: {
				fields: {
					language: {
						type: "string",
						required: false,
						defaultValue: "en",
					},
				},
			},
		},
	},
} satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({
	baseURL: `${location.origin}/api/auth`,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [
		multiSessionClient(),
		userAdditionalFieldsClient,
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
