import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$slug/settings/")({
	beforeLoad: ({ params: { slug } }) => {
		throw redirect({ to: "/$slug/settings/profile", params: { slug } });
	},
});
