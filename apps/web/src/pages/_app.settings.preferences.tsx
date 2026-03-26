import { createFileRoute } from "@tanstack/react-router";

import { PreferencesCard } from "@chevrotain/web/pages/_app.settings.preferences/-components/preferences-card";
import { ProfileCard } from "@chevrotain/web/pages/_app.settings.preferences/-components/profile-card";

export const Route = createFileRoute("/_app/settings/preferences")({
	component: Page,
});

function Page() {
	return (
		<div className="flex flex-col gap-8">
			<ProfileCard />
			<PreferencesCard />
		</div>
	);
}
