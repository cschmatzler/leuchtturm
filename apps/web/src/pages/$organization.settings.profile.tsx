import { createFileRoute } from "@tanstack/react-router";

import { ProfileCard } from "@leuchtturm/web/pages/$organization.settings/-components/profile-card";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/settings/profile")({
	loader: ({ context: { zero } }) => {
		zero.preload(queries.currentUser());
	},
	component: Page,
});

function Page() {
	return (
		<div className="flex flex-col gap-8">
			<ProfileCard />
		</div>
	);
}
