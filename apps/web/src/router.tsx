import type { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import type { Session, User } from "better-auth";

import { NotFound } from "@leuchtturm/web/components/app/not-found";
import { parseSearch, stringifySearch } from "@leuchtturm/web/lib/search-params";
import { routeTree } from "@leuchtturm/web/routeTree.gen";
import type { Zero } from "@leuchtturm/zero/schema";

export interface RouterContext {
	queryClient: QueryClient;
	zero: Zero;
	session:
		| {
				session: Session & { activeOrganizationId?: string | null; activeTeamId?: string | null };
				user: User;
		  }
		| null
		| undefined;
	refetch?: () => Promise<unknown>;
}

export function createRouter() {
	return createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "viewport",
		defaultPreloadDelay: 75,
		defaultPreloadStaleTime: 0,
		defaultPreloadGcTime: 0,
		defaultNotFoundComponent: () => (
			<div className="size-full">
				<NotFound backTo={{ to: "/" }} backLabel="Go home" />
			</div>
		),
		stringifySearch,
		parseSearch,
		context: {
			queryClient: undefined!,
			zero: undefined!,
			session: undefined,
		} satisfies RouterContext,
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createRouter>;
	}
}
