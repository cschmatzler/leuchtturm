import { queryOptions } from "@tanstack/react-query";

import { api } from "@leuchtturm/web/clients/api";

export const billingOverviewQuery = (organizationId: string) =>
	queryOptions({
		queryKey: ["billing", "overview", organizationId] as const,
		staleTime: 30 * 1000,
		queryFn: () => api.billing.overview({ query: { organizationId } }),
	});
