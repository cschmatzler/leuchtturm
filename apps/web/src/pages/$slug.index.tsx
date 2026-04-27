import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$slug/")({
	beforeLoad: ({ params: { slug } }) => {
		throw redirect({
			to: "/$slug/settings/teams",
			params: { slug },
		});
	},
});
