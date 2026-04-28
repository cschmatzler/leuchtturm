import { createFileRoute, Outlet } from "@tanstack/react-router";

import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings")({
	loader: ({ context: { organizationId, zero }, params: { team } }) => {
		zero.preload(queries.organizationTeams({ organizationId }));
		zero.preload(queries.team({ organizationId, team }));
	},
	component: Outlet,
});
