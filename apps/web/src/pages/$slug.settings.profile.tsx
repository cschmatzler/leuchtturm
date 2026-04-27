import { createFileRoute } from "@tanstack/react-router";

import { ProfileCard } from "@leuchtturm/web/pages/$slug.settings/-components/profile-card";

export const Route = createFileRoute("/$slug/settings/profile")({
	component: Page,
});

function Page() {
	return (
		<div className="flex flex-col gap-8">
			<ProfileCard />
		</div>
	);
}
