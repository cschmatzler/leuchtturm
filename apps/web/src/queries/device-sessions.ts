import { queryOptions } from "@tanstack/react-query";

import { api } from "@leuchtturm/web/clients/api";

export const deviceSessionsQuery = () =>
	queryOptions({
		queryKey: ["deviceSessions"] as const,
		staleTime: 30 * 1000,
		queryFn: async () => {
			try {
				return await api.session.deviceSessions();
			} catch {
				return { sessions: [], organizations: [] };
			}
		},
	});
