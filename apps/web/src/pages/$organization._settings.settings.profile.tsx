import { createFileRoute } from "@tanstack/react-router";

import { ProfileCard } from "@leuchtturm/web/pages/$organization._settings.settings/-components/profile-card";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/settings/profile")({
	loader: ({ context: { zero } }) => {
		zero.preload(queries.currentUser());
	},
	component: Page,
});

function Page() {
	return (
		<div className="mx-auto w-full max-w-3xl">
			<ProfileCard />
		</div>
	);
}
