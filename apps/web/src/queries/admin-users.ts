import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@leuchtturm/web/clients/auth";

export type AdminUser = {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	banned?: boolean | null;
	createdAt: Date;
};

export const adminUsersQuery = () =>
	queryOptions({
		queryKey: ["admin-users"] as const,
		queryFn: async (): Promise<AdminUser[]> => {
			const { data, error } = await authClient.admin.listUsers({
				query: {
					sortBy: "createdAt",
					sortDirection: "desc",
				},
			});

			if (error) {
				throw new Error(error.message ?? "Failed to load admin users");
			}

			return data.users.map((user) => ({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				banned: user.banned,
				createdAt: user.createdAt,
			}));
		},
	});
