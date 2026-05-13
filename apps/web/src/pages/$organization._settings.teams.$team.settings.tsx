import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings")({
	loader: async ({ context: { organizationId, zero }, params }) => {
		if (!zero) return;

		zero.preload(queries.organizationTeams({ organizationId }));

		const team = await zero.run(queries.team({ organizationId, team: params.team }));

		if (!team) {
			throw redirect({
				to: "/$organization/settings/teams",
				params: { organization: params.organization },
			});
		}
	},
	component: Outlet,
});
