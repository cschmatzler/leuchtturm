import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Link } from "@leuchtturm/web/components/ui/link";
import { cn } from "@leuchtturm/web/lib/cn";

const SETTINGS_TABS = [
	{ to: "/$slug/teams/$teamSlug/settings/general" as const, labelKey: "General" },
	{ to: "/$slug/teams/$teamSlug/settings/members" as const, labelKey: "Members" },
] as const;

export const Route = createFileRoute("/$slug/_app/teams/$teamSlug/settings")({
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
	const { t } = useTranslation();

	return (
		<div className="flex grow justify-center bg-background">
			<div className="flex max-w-7xl grow flex-col gap-4 px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
				<div className="mx-auto w-full max-w-3xl">
					<nav className="flex gap-1 border-b border-border">
						{SETTINGS_TABS.map((tab) => (
							<Link
								key={tab.to}
								to={tab.to}
								params={{ slug, teamSlug }}
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
		</div>
	);
}
