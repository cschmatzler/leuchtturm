import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$organization/_settings")({
	component: Outlet,
});
