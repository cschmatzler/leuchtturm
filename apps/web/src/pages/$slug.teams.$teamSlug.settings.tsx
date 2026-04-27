import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { SettingsSidebar } from "@leuchtturm/web/components/app/settings-sidebar";

export const Route = createFileRoute("/$slug/teams/$teamSlug/settings")({
	beforeLoad: ({ location, params: { slug, teamSlug } }) => {
		if (
			location.pathname === `/${slug}/teams/${teamSlug}/settings` ||
			location.pathname === `/${slug}/teams/${teamSlug}/settings/`
		) {
			throw redirect({
				to: "/$slug/teams/$teamSlug/settings/general",
				params: { slug, teamSlug },
			});
		}
	},
	component: SettingsLayout,
});

function SettingsLayout() {
	const { slug, teamSlug } = Route.useParams();
	const { organizationId } = Route.useRouteContext();

	return (
		<div className="flex gap-6">
			<SettingsSidebar slug={slug} organizationId={organizationId} teamSlug={teamSlug} />
			<div className="min-w-0 grow">
				<Outlet />
			</div>
		</div>
	);
}
