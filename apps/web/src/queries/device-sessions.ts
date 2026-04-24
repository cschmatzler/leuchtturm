import { queryOptions } from "@tanstack/react-query";

import type { DeviceSessions as DeviceSessionsSchema } from "@leuchtturm/core/auth/schema";
import { api } from "@leuchtturm/web/clients/api";

export type DeviceSessions = typeof DeviceSessionsSchema.Type;

export const deviceSessionsQuery = () =>
	queryOptions({
		queryKey: ["deviceSessions"] as const,
		staleTime: 30 * 1000,
		queryFn: async (): Promise<DeviceSessions> => api.session.deviceSessions(),
	});
