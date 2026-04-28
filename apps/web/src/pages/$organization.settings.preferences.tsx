import { createFileRoute } from "@tanstack/react-router";

import { PreferencesCard } from "@leuchtturm/web/pages/$organization.settings/-components/preferences-card";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/settings/preferences")({
	loader: ({ context: { zero } }) => {
		zero.preload(queries.currentUser());
	},
	component: Page,
});

function Page() {
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
			<PreferencesCard />
		</div>
	);
}
