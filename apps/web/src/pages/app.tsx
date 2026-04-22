import { createFileRoute, redirect } from "@tanstack/react-router";

import { deviceSessionsQuery } from "@leuchtturm/web/queries/device-sessions";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ context: { queryClient } }) => {
		const session = await queryClient.ensureQueryData(sessionQuery());
		if (!session) throw redirect({ to: "/login" });

		const deviceSessions = await queryClient.ensureQueryData(deviceSessionsQuery());
		const firstOrganization = deviceSessions.organizations[0];
		if (!firstOrganization) throw redirect({ to: "/create-organization" });

		throw redirect({
			to: "/$slug/settings/preferences",
			params: { slug: firstOrganization.slug },
		});
	},
	component: () => null,
});
