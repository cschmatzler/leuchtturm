import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { CogIcon, LayersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppHeader } from "@leuchtturm/web/components/app/app-header";
import { useCommandBar } from "@leuchtturm/web/hooks/use-command-bar";
import { useCommandProvider } from "@leuchtturm/web/hooks/use-command-provider";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/teams/$team")({
	loader: ({ context: { organizationId, zero }, params: { team } }) => {
		zero.preload(queries.team({ organizationId, team }));
	},
	component: Layout,
});

function Layout() {
	const { organization, team } = Route.useParams();

	return <TeamLayout organization={organization} team={team} />;
}

function TeamLayout(props: { readonly organization: string; readonly team: string }) {
	const { organizationId } = Route.useRouteContext();
	const [team] = useZeroQuery(queries.team({ organizationId, team: props.team }));
	if (!team) return null;

	return (
		<div className="flex h-svh flex-col">
			<TeamCommands organization={props.organization} team={team} />
			<AppHeader organization={props.organization} activeTeam={team} />
			<main id="main-content" className="min-h-0 grow bg-background">
				<Outlet />
			</main>
		</div>
	);
}

function TeamCommands({
	organization,
	team,
}: {
	readonly organization: string;
	readonly team: { readonly slug: string };
}) {
	const navigate = useNavigate();
	const { organizationId } = Route.useRouteContext();
	const [teams] = useZeroQuery(queries.organizationTeams({ organizationId }));
	const { t } = useTranslation();
	const commandBar = useCommandBar();

	useCommandProvider(
		"teams",
		async () => [
			{
				title: t("Go to team"),
				category: t("Team"),
				global: true,
				icon: LayersIcon,
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
				title: t("Go to {{team}}", { team: team.name }),
				value: team.id,
				category: t("Team"),
				icon: LayersIcon,
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
				icon: CogIcon,
				run() {
					navigate({
						to: "/$organization/teams/$team/settings/general",
						params: { organization, team: team.slug },
					});
				},
			},
		],
		[navigate, organization, t, team],
	);

	return null;
}
