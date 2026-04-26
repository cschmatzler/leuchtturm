import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$slug/_app/teams/$teamSlug")({
	component: Layout,
});

function Layout() {
	return <Outlet />;
}
