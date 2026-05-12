import { GearIcon } from "@phosphor-icons/react/Gear";
import { StackIcon } from "@phosphor-icons/react/Stack";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useGT } from "gt-react";

import { AppHeader } from "@leuchtturm/web/components/app/app-header";
import { useCommandBar } from "@leuchtturm/web/hooks/use-command-bar";
import { useCommandProvider } from "@leuchtturm/web/hooks/use-command-provider";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/teams/$team")({
	loader: ({ context: { organizationId, zero }, params: { team } }) => {
		zero?.preload(queries.team({ organizationId, team }));
	},
	component: Layout,
});

function Layout() {
	const { organization, team } = Route.useParams();
	const { organizationId } = Route.useRouteContext();
	const navigate = useNavigate();

	const [currentTeam] = useZeroQuery(queries.team({ organizationId, team }));
	const [teams] = useZeroQuery(queries.organizationTeams({ organizationId }));

	const t = useGT();
	const commandBar = useCommandBar();

	useCommandProvider(
		"teams",
		async () => [
			{
				title: t("Go to team"),
				category: t("Team"),
				global: true,
				icon: StackIcon,
				disabled: teams.length === 0,
				run() {
					commandBar.show("select-team");
				},
			},
		],
		[commandBar, navigate, organization, t, teams],
	);

	useCommandProvider(
		"select-team",
		async () =>
			teams.map((team) => ({
				title: t("Go to {team}", { team: team.name }),
				value: team.id,
				category: t("Team"),
				icon: StackIcon,
				run() {
					navigate({
						to: "/$organization/teams/$team",
						params: { organization, team: team.slug },
					});
				},
			})),
		[navigate, organization, t, teams],
	);

	useCommandProvider(
		"navigation",
		async () => [
			{
				title: t("Go to Team settings"),
				category: t("Navigation"),
				global: true,
				icon: GearIcon,
				run() {
					const currentTeam = teams.find((currentTeam) => currentTeam.slug === team);
					if (!currentTeam) return;
					navigate({
						to: "/$organization/teams/$team/settings/general",
						params: { organization, team: currentTeam.slug },
					});
				},
			},
		],
		[navigate, organization, team, t, teams],
	);

	if (!currentTeam) return null;

	return (
		<div className="flex h-svh flex-col">
			<AppHeader organization={organization} team={team} />
			<main id="main-content" className="min-h-0 grow bg-background">
				<Outlet />
			</main>
		</div>
	);
}
