import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$organization/")({
	beforeLoad: ({ params: { organization: slug } }) => {
		throw redirect({
			to: "/$organization/settings/teams",
			params: { organization: slug },
		});
	},
});
