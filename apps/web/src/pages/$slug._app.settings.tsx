import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Content, Header } from "@leuchtturm/web/components/app/layout";
import { Link } from "@leuchtturm/web/components/ui/link";
import { cn } from "@leuchtturm/web/lib/cn";

const SETTINGS_TABS = [
	{ to: "/$slug/settings/preferences" as const, labelKey: "Preferences" },
	{ to: "/$slug/settings/billing" as const, labelKey: "Billing" },
] as const;

export const Route = createFileRoute("/$slug/_app/settings")({
	beforeLoad: ({ location, params: { slug } }) => {
		if (location.pathname === `/${slug}/settings` || location.pathname === `/${slug}/settings/`) {
			throw redirect({ to: "/$slug/settings/preferences", params: { slug } });
		}
	},
	component: SettingsLayout,
});

function SettingsLayout() {
	const { slug } = Route.useParams();
	const { t } = useTranslation();

	return (
		<>
			<Header>{t("Settings")}</Header>
			<Content>
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
			</Content>
		</>
	);
}
