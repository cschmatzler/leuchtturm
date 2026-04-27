import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { ZeroProvider } from "@leuchtturm/web/contexts/zero";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export const Route = createFileRoute("/$slug")({
	beforeLoad: async ({ params: { slug }, context: { queryClient } }) => {
		const session = await queryClient.ensureQueryData(sessionQuery());
		if (!session) throw redirect({ to: "/login" });

		const organizations = await queryClient.ensureQueryData(organizationsQuery());
		if (organizations.length === 0) {
			throw redirect({ to: "/create-organization" });
		}

		const targetOrganization = organizations.find(
			(currentOrganization) => currentOrganization.slug === slug,
		);
		if (!targetOrganization) {
			const nextSlug = organizations[0]?.slug;
			if (nextSlug) {
				throw redirect({
					to: "/$slug/settings",
					params: { slug: nextSlug },
				});
			}
			throw redirect({ to: "/create-organization" });
		}

		return { session, organizationId: targetOrganization.id };
	},
	component: Layout,
});

function Layout() {
	const { session } = Route.useRouteContext();
	const { slug } = Route.useParams();

	return (
		<ZeroProvider session={session} slug={slug}>
			<Outlet />
		</ZeroProvider>
	);
}
