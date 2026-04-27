import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppHeader } from "@leuchtturm/web/components/app/app-header";
import { SettingsSidebar } from "@leuchtturm/web/components/app/settings-sidebar";

export const Route = createFileRoute("/$slug/settings")({
	beforeLoad: ({ location, params: { slug } }) => {
		if (location.pathname === `/${slug}/settings` || location.pathname === `/${slug}/settings/`) {
			throw redirect({ to: "/$slug/settings/profile", params: { slug } });
		}
	},
	component: SettingsLayout,
});

function SettingsLayout() {
	const { slug } = Route.useParams();
	const { organizationId } = Route.useRouteContext();

	return (
		<>
			<AppHeader slug={slug} organizationId={organizationId} />
			<main id="main-content" className="flex grow justify-center bg-background">
				<div className="flex max-w-7xl grow gap-6 px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
					<SettingsSidebar slug={slug} organizationId={organizationId} />
					<div className="min-w-0 grow">
						<Outlet />
					</div>
				</div>
			</main>
		</>
	);
}
