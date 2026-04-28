import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings/")({
	beforeLoad: ({ params: { organization: slug, team: teamSlug } }) => {
		throw redirect({
			to: "/$organization/teams/$team/settings/general",
			params: { organization: slug, team: teamSlug },
		});
	},
});
