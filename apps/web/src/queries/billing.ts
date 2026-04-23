import { queryOptions } from "@tanstack/react-query";

import { api } from "@leuchtturm/web/clients/api";

export const billingOverviewQuery = () =>
	queryOptions({
		queryKey: ["billing", "overview"] as const,
		staleTime: 30 * 1000,
		queryFn: () => api.billing.overview(),
	});
