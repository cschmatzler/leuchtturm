import { createFileRoute, redirect } from "@tanstack/react-router";

import { AuthSidePanel } from "@leuchtturm/web/components/app/auth-side-panel";
import { CreateOrganizationForm } from "@leuchtturm/web/pages/create-organization/-components/create-organization-form";
import { CreateOrganizationHeader } from "@leuchtturm/web/pages/create-organization/-components/create-organization-header";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export const Route = createFileRoute("/create-organization")({
	beforeLoad: async ({ context: { queryClient } }) => {
		const session = await queryClient.ensureQueryData(sessionQuery());
		if (!session) throw redirect({ to: "/login" });

		return { session };
	},
	component: Page,
});

function Page() {
	return (
		<div className="grid min-h-svh w-full lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<CreateOrganizationHeader />
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md">
						<CreateOrganizationForm />
					</div>
				</div>
			</div>
			<AuthSidePanel />
		</div>
	);
}
