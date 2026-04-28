import { createFileRoute, Outlet } from "@tanstack/react-router";

import { SettingsSidebar } from "@leuchtturm/web/components/app/settings-sidebar";
import { SidebarInset, SidebarProvider } from "@leuchtturm/web/components/ui/sidebar";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/teams/$team/settings")({
	loader: ({ context: { organizationId, zero }, params: { team: teamSlug } }) => {
		zero.preload(queries.organizationTeams({ organizationId }));
		zero.preload(queries.team({ organizationId, teamSlug }));
	},
	component: SettingsLayout,
});

function SettingsLayout() {
	const { organization: slug, team: teamSlug } = Route.useParams();

	return (
		<SidebarProvider className="relative h-full min-h-0">
			<SettingsSidebar slug={slug} teamSlug={teamSlug} />
			<SidebarInset className="bg-background">
				<div className="mx-auto flex max-w-7xl grow flex-col px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
