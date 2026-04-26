import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authClient } from "@leuchtturm/web/clients/auth";
import { ZeroProvider } from "@leuchtturm/web/contexts/zero";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { sessionQuery } from "@leuchtturm/web/queries/session";
import { teamsQuery } from "@leuchtturm/web/queries/teams";

export const Route = createFileRoute("/$slug")({
	beforeLoad: async ({ params: { slug }, location, context: { queryClient } }) => {
		const session = await queryClient.ensureQueryData(sessionQuery());
		if (!session) throw redirect({ to: "/login" });

		const organizations = await queryClient.ensureQueryData(organizationsQuery());
		if (organizations.length === 0) {
			throw redirect({ to: "/create-organization" });
		}

		const targetOrganization = organizations.find(
			(currentOrganization) => currentOrganization.slug === slug,
		);
		if (!targetOrganization) {
			const nextSlug = organizations[0]?.slug;
			if (nextSlug) {
				throw redirect({
					to: "/$slug/settings/preferences",
					params: { slug: nextSlug },
				});
			}
			throw redirect({ to: "/create-organization" });
		}

		const needsOrganizationSwitch = targetOrganization.id !== session.session.activeOrganizationId;

		if (needsOrganizationSwitch) {
			await authClient.organization.setActive({ organizationId: targetOrganization.id });

			await queryClient.invalidateQueries({ queryKey: ["session"] });
			await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
			await queryClient.invalidateQueries({ queryKey: ["organizations"] });

			const refreshedSession = await queryClient.fetchQuery(sessionQuery());
			if (!refreshedSession) throw redirect({ to: "/login" });

			if (location.pathname === `/${slug}` || location.pathname === `/${slug}/`) {
				const teams = await queryClient.ensureQueryData(teamsQuery(targetOrganization.id));
				const nextTeam =
					teams.find((team) => team.id === refreshedSession.session.activeTeamId) ?? teams[0];
				if (nextTeam) {
					throw redirect({
						to: "/$slug/teams/$teamId",
						params: { slug, teamId: nextTeam.id },
					});
				}
				throw redirect({
					to: "/$slug/settings/teams",
					params: { slug },
				});
			}

			return { session: refreshedSession, organizationId: targetOrganization.id };
		}

		if (location.pathname === `/${slug}` || location.pathname === `/${slug}/`) {
			const teams = await queryClient.ensureQueryData(teamsQuery(targetOrganization.id));
			const nextTeam = teams.find((team) => team.id === session.session.activeTeamId) ?? teams[0];
			if (nextTeam) {
				throw redirect({
					to: "/$slug/teams/$teamId",
					params: { slug, teamId: nextTeam.id },
				});
			}
			throw redirect({
				to: "/$slug/settings/teams",
				params: { slug },
			});
		}

		return { session, organizationId: targetOrganization.id };
	},
	component: Layout,
});

function Layout() {
	const { session } = Route.useRouteContext();
	const { slug } = Route.useParams();

	return (
		<ZeroProvider session={session} slug={slug}>
			<Outlet />
		</ZeroProvider>
	);
}
