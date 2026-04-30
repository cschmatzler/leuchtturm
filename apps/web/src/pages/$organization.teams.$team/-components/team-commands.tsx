import { GearIcon, StackIcon } from "@phosphor-icons/react";
import { useNavigate, useParams, useRouteContext } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useCommandBar } from "@leuchtturm/web/hooks/use-command-bar";
import { useCommandProvider } from "@leuchtturm/web/hooks/use-command-provider";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export function TeamCommands() {
	const navigate = useNavigate();
	const params = useParams({ from: "/$organization/teams/$team" });
	const { organizationId } = useRouteContext({ from: "/$organization/teams/$team" });
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
				icon: StackIcon,
				disabled: teams.length === 0,
				run() {
					commandBar.show("select-team");
				},
			},
		],
		[commandBar, navigate, params.organization, t, teams],
	);

	useCommandProvider(
		"select-team",
		async () =>
			teams.map((team) => ({
				title: t("Go to {{team}}", { team: team.name }),
				value: team.id,
				category: t("Team"),
				icon: StackIcon,
				run() {
					navigate({
						to: "/$organization/teams/$team",
						params: { organization: params.organization, team: team.slug },
					});
				},
			})),
		[navigate, params.organization, t, teams],
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
					const team = teams.find((team) => team.slug === params.team);
					if (!team) return;
					navigate({
						to: "/$organization/teams/$team/settings/general",
						params: { organization: params.organization, team: team.slug },
					});
				},
			},
		],
		[navigate, params.organization, params.team, t, teams],
	);

	return null;
}
