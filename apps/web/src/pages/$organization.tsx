import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { Organization } from "@leuchtturm/core/auth/schema";
import { ZeroProvider } from "@leuchtturm/web/contexts/zero";
import { OrganizationCommands } from "@leuchtturm/web/pages/$organization/-components/organization-commands";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export const Route = createFileRoute("/$organization")({
	beforeLoad: async ({ params: { organization }, context: { queryClient } }) => {
		const session = await queryClient.ensureQueryData(sessionQuery());
		if (!session) throw redirect({ to: "/login" });

		const organizations = await queryClient.ensureQueryData(organizationsQuery());
		if (organizations.length === 0) {
			throw redirect({ to: "/create-organization" });
		}

		const targetOrganization = organizations.find(
			(currentOrganization) => currentOrganization.slug === organization,
		);
		if (!targetOrganization) {
			const nextOrganization = organizations[0]?.slug;
			if (nextOrganization) {
				throw redirect({
					to: "/$organization/settings",
					params: { organization: nextOrganization },
				});
			}
			throw redirect({ to: "/create-organization" });
		}

		return {
			session,
			organizationId: Schema.decodeUnknownSync(Organization.fields.id)(targetOrganization.id),
		};
	},
	component: Layout,
});

function Layout() {
	const { organization } = Route.useParams();
	const { session } = Route.useRouteContext();

	return (
		<ZeroProvider session={session} organization={organization}>
			<OrganizationCommands />
			<Outlet />
		</ZeroProvider>
	);
}
