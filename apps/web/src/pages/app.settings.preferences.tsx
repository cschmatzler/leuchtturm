import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Content, Header } from "@chevrotain/web/components/app/layout";
import { PreferencesCard } from "@chevrotain/web/pages/app.settings.preferences/-components/preferences-card";
import { ProfileCard } from "@chevrotain/web/pages/app.settings.preferences/-components/profile-card";

export const Route = createFileRoute("/app/settings/preferences")({
	component: Page,
});

function Page() {
	const { t } = useTranslation();

	return (
		<>
			<Header>{t("Preferences")}</Header>
			<Content>
				<div className="mx-auto w-full max-w-3xl">
					<div className="mb-8">
						<h1 className="text-2xl font-semibold tracking-tight">{t("Preferences")}</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("Manage your profile and application preferences.")}
						</p>
					</div>
					<div className="flex flex-col gap-8">
						<ProfileCard />
						<PreferencesCard />
					</div>
				</div>
			</Content>
		</>
	);
}
