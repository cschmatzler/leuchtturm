import { createAuthClient } from "better-auth/react";
import { multiSessionClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
	baseURL: `${import.meta.env.VITE_BASE_URL}/api/auth`,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [multiSessionClient()],
});
