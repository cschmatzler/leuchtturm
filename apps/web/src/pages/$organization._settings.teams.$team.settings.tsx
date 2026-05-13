import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings")({
	loader: async ({ context: { organizationId, zero }, params: { organization, team } }) => {
		if (!zero) return;
		const currentTeam = await zero.run(queries.team({ organizationId, team: team }));

		if (!currentTeam) {
			throw redirect({
				to: "/$organization/settings/teams",
				params: { organization: organization },
			});
		}
	},
	component: Outlet,
});
