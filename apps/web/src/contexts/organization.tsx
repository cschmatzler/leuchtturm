import { RouterContextProvider, useRouter } from "@tanstack/react-router";
import { AutumnProvider, useCustomer } from "autumn-js/react";
import { useEffect, type ReactNode } from "react";

import { Loading } from "@leuchtturm/web/components/loading";
import { ZeroProvider, type SessionData } from "@leuchtturm/web/contexts/zero";

export function OrganizationProvider({
	session,
	organization,
	organizationId,
	children,
}: {
	session: SessionData;
	organization: string;
	organizationId: string;
	children: ReactNode;
}) {
	return (
		<AutumnProvider
			key={organizationId}
			backendUrl={import.meta.env.VITE_API_URL}
			pathPrefix="/api/autumn"
			includeCredentials
		>
			<OrganizationLoader
				session={session}
				organization={organization}
				organizationId={organizationId}
			>
				{children}
			</OrganizationLoader>
		</AutumnProvider>
	);
}

function OrganizationLoader({
	session,
	organization,
	organizationId,
	children,
}: {
	session: SessionData;
	organization: string;
	organizationId: string;
	children: ReactNode;
}) {
	const router = useRouter();

	const { customer, refetch, isLoading, error } = useCustomer();

	useEffect(() => {
		refetch();
	}, [refetch, organizationId]);

	if (isLoading) return <Loading />;
	if (error) throw error;
	if (!customer || customer.id !== organizationId) return <Loading />;

	return (
		<RouterContextProvider router={router} context={{ refetch }}>
			<ZeroProvider session={session} organization={organization}>
				{children}
			</ZeroProvider>
		</RouterContextProvider>
	);
}
