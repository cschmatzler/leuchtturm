import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$organization/_settings/settings/")({
	beforeLoad: ({ params: { organization } }) => {
		throw redirect({ to: "/$organization/settings/profile", params: { organization } });
	},
});
