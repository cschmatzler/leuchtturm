import { createFileRoute } from "@tanstack/react-router";

import { PreferencesCard } from "@leuchtturm/web/pages/$slug.settings/-components/preferences-card";

export const Route = createFileRoute("/$slug/settings/preferences")({
	component: Page,
});

function Page() {
	return (
		<div className="flex flex-col gap-8">
			<PreferencesCard />
		</div>
	);
}
