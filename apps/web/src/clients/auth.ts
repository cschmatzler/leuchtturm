import { multiSessionClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: `${location.origin}/api/auth`,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [multiSessionClient(), organizationClient()],
});
