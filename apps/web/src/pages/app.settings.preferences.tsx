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
				<div className="flex w-full flex-col items-center">
					<div className="flex w-full max-w-3xl flex-col gap-7">
						<ProfileCard />
						<PreferencesCard />
					</div>
				</div>
			</Content>
		</>
	);
}
