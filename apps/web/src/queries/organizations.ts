import { Zero } from "@rocicorp/zero";
import { queryOptions } from "@tanstack/react-query";
import type { Session, User } from "better-auth";

import { mutators } from "@leuchtturm/zero/mutators";
import { queries } from "@leuchtturm/zero/queries";
import { schema } from "@leuchtturm/zero/schema";

export type Organizations = Array<{
	readonly id: string;
	readonly name: string;
	readonly slug: string;
	readonly createdAt: number;
}>;

export type OrganizationsSession = {
	readonly session: Session;
	readonly user: User;
};

export const organizationsQuery = (session: OrganizationsSession) =>
	queryOptions({
		queryKey: ["organizations", session.user.id] as const,
		staleTime: 30 * 1000,
		queryFn: async (): Promise<Organizations> => {
			const zero = new Zero({
				schema,
				cacheURL: import.meta.env.VITE_SYNC_URL,
				userID: session.user.id,
				context: { userId: session.user.id },
				mutators,
				storageKey: "organizations",
			});
			return await zero.run(queries.currentUserOrganizations());
		},
	});
