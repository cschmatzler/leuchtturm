import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authClient } from "@leuchtturm/web/clients/auth";
import { sessionQuery } from "@leuchtturm/web/queries/session";
import { teamsQuery } from "@leuchtturm/web/queries/teams";

export const Route = createFileRoute("/$slug/_app/teams/$teamId")({
	beforeLoad: async ({ params: { slug, teamId }, context: { queryClient, session } }) => {
		const organizationId = session?.session.activeOrganizationId;
		if (!session || !organizationId) throw redirect({ to: "/login" });

		const teams = await queryClient.ensureQueryData(teamsQuery(organizationId));
		const team = teams.find((currentTeam) => currentTeam.id === teamId);
		if (!team) {
			const nextTeam = teams[0];
			if (nextTeam) {
				throw redirect({
					to: "/$slug/teams/$teamId",
					params: { slug, teamId: nextTeam.id },
				});
			}
			throw redirect({ to: "/$slug/settings/teams", params: { slug } });
		}

		if (session.session.activeTeamId !== team.id) {
			await authClient.organization.setActiveTeam({ teamId: team.id });
			await queryClient.invalidateQueries({ queryKey: ["session"] });
			const refreshedSession = await queryClient.fetchQuery(sessionQuery());
			if (!refreshedSession) throw redirect({ to: "/login" });
			return { team, session: refreshedSession };
		}

		return { team, session };
	},
	component: Layout,
});

function Layout() {
	const queryClient = useQueryClient();
	const { session } = Route.useRouteContext();

	queryClient.setQueryData(sessionQuery().queryKey, session);

	return <Outlet />;
}
