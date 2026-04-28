import { createFileRoute, redirect } from "@tanstack/react-router";

import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ context: { queryClient } }) => {
		const session = await queryClient.ensureQueryData(sessionQuery());
		if (!session) throw redirect({ to: "/login" });

		const organizations = await queryClient.ensureQueryData(organizationsQuery(session));
		const firstOrganization = organizations[0];
		if (!firstOrganization) throw redirect({ to: "/create-organization" });

		throw redirect({
			to: "/$organization/settings",
			params: { organization: firstOrganization.slug },
		});
	},
	component: () => null,
});
