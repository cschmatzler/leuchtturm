import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@leuchtturm/web/clients/auth";

export const authAccountsQuery = () =>
	queryOptions({
		queryKey: ["authAccounts"] as const,
		queryFn: async () => {
			const { data, error } = await authClient.listAccounts();
			if (error) throw error;

			return data;
		},
	});
