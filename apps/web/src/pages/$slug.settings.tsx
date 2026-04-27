import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppHeader } from "@leuchtturm/web/components/app/app-header";
import { SettingsSidebar } from "@leuchtturm/web/components/app/settings-sidebar";
import { SidebarInset, SidebarProvider } from "@leuchtturm/web/components/ui/sidebar";

export const Route = createFileRoute("/$slug/settings")({
	component: SettingsLayout,
});

function SettingsLayout() {
	const { slug } = Route.useParams();
	const { organizationId } = Route.useRouteContext();

	return (
		<div className="flex h-svh flex-col">
			<AppHeader slug={slug} organizationId={organizationId} />
			<main id="main-content" className="min-h-0 grow bg-background">
				<SidebarProvider className="relative h-full min-h-0">
					<SettingsSidebar slug={slug} organizationId={organizationId} />
					<SidebarInset className="bg-background">
						<div className="flex max-w-7xl grow flex-col px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
							<Outlet />
						</div>
					</SidebarInset>
				</SidebarProvider>
			</main>
		</div>
	);
}
