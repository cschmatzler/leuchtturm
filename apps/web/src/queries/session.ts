import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@chevrotain/web/clients/auth";

export const sessionQuery = () =>
	queryOptions({
		queryKey: ["session"] as const,
		staleTime: 5 * 60 * 1000,
		refetchInterval: 5 * 60 * 1000,
		queryFn: async () => {
			const { data: session } = await authClient.getSession();

			return session?.session && session.user ? session : null;
		},
	});

export const deviceSessionsQuery = () =>
	queryOptions({
		queryKey: ["deviceSessions"] as const,
		staleTime: 30 * 1000,
		queryFn: async () => {
			const { data } = await authClient.multiSession.listDeviceSessions();

			return data ?? [];
		},
	});
