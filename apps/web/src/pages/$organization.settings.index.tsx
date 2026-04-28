import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$organization/settings/")({
	beforeLoad: ({ params: { organization: slug } }) => {
		throw redirect({ to: "/$organization/settings/profile", params: { organization: slug } });
	},
});
