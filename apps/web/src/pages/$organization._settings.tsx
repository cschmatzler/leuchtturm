import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createContext, useState } from "react";
import type { CSSProperties } from "react";

import { AppHeader } from "@leuchtturm/web/components/app/app-header";
import { SettingsSidebar } from "@leuchtturm/web/components/app/settings-sidebar";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@leuchtturm/web/components/ui/sidebar";

export const SettingsTeamContext = createContext<(team: string | undefined) => void>(() => {});

export const Route = createFileRoute("/$organization/_settings")({
	component: SettingsLayout,
});

function SettingsLayout() {
	const { organization } = Route.useParams();
	const [team, setTeam] = useState<string>();

	return (
		<SettingsTeamContext.Provider value={setTeam}>
			<div className="flex h-svh flex-col">
				<AppHeader organization={organization} team={team} />
				<main id="main-content" className="min-h-0 grow bg-background">
					<SidebarProvider
						className="relative h-full min-h-0"
						style={{ "--sidebar-width": "13rem" } as CSSProperties}
					>
						<SettingsSidebar organization={organization} />
						<SidebarInset className="bg-background">
							<div className="mx-auto flex w-full max-w-7xl grow flex-col px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
								<SidebarTrigger className="mb-4 md:hidden" />
								<Outlet />
							</div>
						</SidebarInset>
					</SidebarProvider>
				</main>
			</div>
		</SettingsTeamContext.Provider>
	);
}
