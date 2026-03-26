import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Content, Header } from "@chevrotain/web/components/app/layout";
import { Link } from "@chevrotain/web/components/ui/link";
import { cn } from "@chevrotain/web/lib/cn";

const SETTINGS_TABS = [
	{ to: "/settings/preferences" as const, labelKey: "Preferences" },
	{ to: "/settings/mail" as const, labelKey: "Mail accounts" },
	{ to: "/settings/billing" as const, labelKey: "Billing" },
] as const;

export const Route = createFileRoute("/_app/settings")({
	beforeLoad: ({ location }) => {
		if (location.pathname === "/settings") {
			throw redirect({ to: "/settings/preferences" });
		}
	},
	component: SettingsLayout,
});

function SettingsLayout() {
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
