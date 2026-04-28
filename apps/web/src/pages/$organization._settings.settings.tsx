import { createFileRoute, Outlet } from "@tanstack/react-router";

import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/settings")({
	loader: ({ context: { organizationId, zero } }) => {
		zero.preload(queries.organizationTeams({ organizationId }));
	},
	component: Outlet,
});
