import { queryOptions } from "@tanstack/react-query";

import { api } from "@leuchtturm/web/clients/api";

export const deviceSessionsQuery = () =>
	queryOptions({
		queryKey: ["deviceSessions"] as const,
		staleTime: 30 * 1000,
		queryFn: () => api.session.deviceSessions(),
	});
