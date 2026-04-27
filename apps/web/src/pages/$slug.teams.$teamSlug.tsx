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
		<>
			<AppHeader
				slug={slug}
				organizationId={organizationId}
				activeTeam={team ?? undefined}
				teamSlug={teamSlug}
			/>
			<main id="main-content" className="flex grow justify-center bg-background">
				<div className="flex max-w-7xl grow flex-col gap-4 px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
					<Outlet />
				</div>
			</main>
		</>
	);
}
