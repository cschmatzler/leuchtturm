import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@leuchtturm/web/clients/auth";

export const customerStateQuery = () =>
	queryOptions({
		queryKey: ["billing", "customerState"] as const,
		staleTime: 30 * 1000,
		queryFn: async () => {
			const { data } = await authClient.customer.state();

			return data ?? null;
		},
	});
