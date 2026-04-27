import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$slug/teams/$teamSlug/settings/")({
	beforeLoad: ({ params: { slug, teamSlug } }) => {
		throw redirect({
			to: "/$slug/teams/$teamSlug/settings/general",
			params: { slug, teamSlug },
		});
	},
});
