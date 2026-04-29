import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@leuchtturm/web/clients/auth";

type Organizations = Array<{
	readonly id: string;
	readonly name: string;
	readonly slug: string;
	readonly createdAt: Date;
	readonly logo?: string | null;
	readonly metadata?: unknown;
}>;

export const organizationsQuery = () =>
	queryOptions({
		queryKey: ["organizations"] as const,
		staleTime: 30 * 1000,
		queryFn: async (): Promise<Organizations> => {
			const { data, error } = await authClient.organization.list();
			if (error) throw error;
			return data;
		},
	});
