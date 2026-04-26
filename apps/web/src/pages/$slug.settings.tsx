import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { AppHeader } from "@leuchtturm/web/components/app/app-header";
import { Link } from "@leuchtturm/web/components/ui/link";
import { cn } from "@leuchtturm/web/lib/cn";

const SETTINGS_TABS = [
	{ to: "/$slug/settings/preferences" as const, labelKey: "Preferences" },
	{ to: "/$slug/settings/members" as const, labelKey: "Members" },
	{ to: "/$slug/settings/teams" as const, labelKey: "Teams" },
	{ to: "/$slug/settings/billing" as const, labelKey: "Billing" },
] as const;

export const Route = createFileRoute("/$slug/settings")({
	beforeLoad: ({ location, params: { slug } }) => {
		if (location.pathname === `/${slug}/settings` || location.pathname === `/${slug}/settings/`) {
			throw redirect({ to: "/$slug/settings/preferences", params: { slug } });
		}
	},
	component: SettingsLayout,
});

function SettingsLayout() {
	const { slug } = Route.useParams();
	const { organizationId } = Route.useRouteContext();
	const { t } = useTranslation();

	return (
		<>
			<AppHeader slug={slug} organizationId={organizationId} />
			<main id="main-content" className="flex grow justify-center bg-background">
				<div className="flex max-w-7xl grow flex-col gap-4 px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
					<div className="mx-auto w-full max-w-3xl">
						<nav className="flex gap-1 border-b border-border">
							{SETTINGS_TABS.map((tab) => (
								<Link
									key={tab.to}
									to={tab.to}
									params={{ slug }}
									className={cn(
										"-mb-px inline-flex items-center border-b-2 border-transparent px-3 pb-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
										"data-[active]:border-foreground data-[active]:text-foreground",
									)}
								>
									{t(tab.labelKey)}
								</Link>
							))}
						</nav>
						<div className="pt-6">
							<Outlet />
						</div>
					</div>
				</div>
			</main>
		</>
	);
}
