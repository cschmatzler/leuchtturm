import { polarClient } from "@polar-sh/better-auth";
import { multiSessionClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getApiBaseUrl } from "@chevrotain/web/runtime";

export const authClient = createAuthClient({
	baseURL: `${getApiBaseUrl()}/api/auth`,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [multiSessionClient(), polarClient()],
});
