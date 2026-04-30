import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppHeader } from "@leuchtturm/web/components/app/app-header";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { TeamCommands } from "@leuchtturm/web/pages/$organization.teams.$team/-components/team-commands";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/teams/$team")({
	loader: ({ context: { organizationId, zero }, params: { team } }) => {
		zero.preload(queries.team({ organizationId, team }));
	},
	component: Layout,
});

function Layout() {
	const { organization, team } = Route.useParams();
	const { organizationId } = Route.useRouteContext();
	const [currentTeam] = useZeroQuery(queries.team({ organizationId, team }));
	if (!currentTeam) return null;

	return (
		<div className="flex h-svh flex-col">
			<TeamCommands />
			<AppHeader organization={organization} team={team} />
			<main id="main-content" className="min-h-0 grow bg-background">
				<Outlet />
			</main>
		</div>
	);
}
