import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppHeader } from "@leuchtturm/web/components/app/app-header";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$slug/teams/$teamSlug")({
	component: Layout,
});

function Layout() {
	const { slug, teamSlug } = Route.useParams();
	const { organizationId } = Route.useRouteContext();
	const [team] = useZeroQuery(queries.team({ organizationId, teamSlug }));

	return (
		<div className="flex h-svh flex-col">
			<AppHeader
				slug={slug}
				organizationId={organizationId}
				activeTeam={team ?? undefined}
				teamSlug={teamSlug}
			/>
			<main id="main-content" className="min-h-0 grow bg-background">
				<Outlet />
			</main>
		</div>
	);
}
