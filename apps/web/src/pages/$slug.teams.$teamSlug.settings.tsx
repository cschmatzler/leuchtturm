import { createFileRoute, Outlet } from "@tanstack/react-router";

import { SettingsSidebar } from "@leuchtturm/web/components/app/settings-sidebar";
import { SidebarInset, SidebarProvider } from "@leuchtturm/web/components/ui/sidebar";

export const Route = createFileRoute("/$slug/teams/$teamSlug/settings")({
	component: SettingsLayout,
});

function SettingsLayout() {
	const { slug, teamSlug } = Route.useParams();
	const { organizationId } = Route.useRouteContext();

	return (
		<SidebarProvider className="relative h-full min-h-0">
			<SettingsSidebar slug={slug} organizationId={organizationId} teamSlug={teamSlug} />
			<SidebarInset className="bg-background">
				<div className="flex max-w-7xl grow flex-col px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
