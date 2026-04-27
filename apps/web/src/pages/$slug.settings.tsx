import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import { AppHeader } from "@leuchtturm/web/components/app/app-header";
import { SettingsSidebar } from "@leuchtturm/web/components/app/settings-sidebar";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@leuchtturm/web/components/ui/sidebar";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$slug/settings")({
	loader: ({ context: { organizationId, zero } }) => {
		zero.preload(queries.organizationTeams({ organizationId }));
	},
	component: SettingsLayout,
});

function SettingsLayout() {
	const { slug } = Route.useParams();

	return (
		<div className="flex h-svh flex-col">
			<AppHeader slug={slug} />
			<main id="main-content" className="min-h-0 grow bg-background">
				<SidebarProvider
					className="relative h-full min-h-0"
					style={{ "--sidebar-width": "13rem" } as CSSProperties}
				>
					<SettingsSidebar slug={slug} />
					<SidebarInset className="bg-background">
						<div className="flex max-w-7xl grow flex-col px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
							<SidebarTrigger className="mb-4 md:hidden" />
							<Outlet />
						</div>
					</SidebarInset>
				</SidebarProvider>
			</main>
		</div>
	);
}
