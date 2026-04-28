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
		<div className="flex h-svh flex-col">
			<AppHeader slug={slug} />
			<main id="main-content" className="min-h-0 grow bg-background">
				<SidebarProvider
					className="relative h-full min-h-0"
					style={{ "--sidebar-width": "13rem" } as CSSProperties}
				>
					<SettingsSidebar slug={slug} teamSlug={teamSlug} />
					<SidebarInset className="bg-background">
						<div className="mx-auto flex w-full max-w-7xl grow flex-col px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
							<SidebarTrigger className="mb-4 md:hidden" />
							<Outlet />
						</div>
					</SidebarInset>
				</SidebarProvider>
			</main>
		</div>
	);
}
