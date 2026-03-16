import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/settings")({
	beforeLoad: ({ location }) => {
		if (location.pathname === "/app/settings") {
			throw redirect({ to: "/app/settings/preferences" });
		}
	},
	component: () => <Outlet />,
});
