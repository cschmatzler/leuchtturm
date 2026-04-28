import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$organization/")({
	beforeLoad: ({ params: { organization } }) => {
		throw redirect({
			to: "/$organization/settings/teams",
			params: { organization },
		});
	},
});
