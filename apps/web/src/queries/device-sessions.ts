import { queryOptions } from "@tanstack/react-query";

import type { DeviceSessions as DeviceSessionsSchema } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";

type DeviceSessions = typeof DeviceSessionsSchema.Type;

export const deviceSessionsQuery = () =>
	queryOptions({
		queryKey: ["deviceSessions"] as const,
		staleTime: 30 * 1000,
		queryFn: async (): Promise<DeviceSessions> => {
			const { data, error } = await authClient.multiSession.listDeviceSessions();
			if (error) throw error;

			return data as unknown as DeviceSessions;
		},
	});
