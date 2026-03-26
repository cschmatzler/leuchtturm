import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/mail")({
	component: MailLayout,
});

function MailLayout() {
	return <Outlet />;
}
