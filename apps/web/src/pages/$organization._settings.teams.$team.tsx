import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useContext, useLayoutEffect } from "react";

import { SettingsTeamContext } from "@leuchtturm/web/pages/$organization._settings";

export const Route = createFileRoute("/$organization/_settings/teams/$team")({
	component: TeamSettingsLayout,
});

function TeamSettingsLayout() {
	const { team } = Route.useParams();
	const setTeam = useContext(SettingsTeamContext);

	useLayoutEffect(() => {
		setTeam(team);
		return () => {
			setTeam(undefined);
		};
	}, [setTeam, team]);

	return <Outlet />;
}
