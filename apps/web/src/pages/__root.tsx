import {
	PostHogErrorBoundary,
	type PostHogErrorBoundaryFallbackProps,
	usePostHog,
} from "@posthog/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools";
import { pacerDevtoolsPlugin } from "@tanstack/react-pacer-devtools";
import { useQuery } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	type ErrorComponentProps,
	Outlet,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { AlertCircleIcon } from "lucide-react";
import { useEffect } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";

import { i18n } from "@leuchtturm/web/clients/i18n";
import { CommandBar } from "@leuchtturm/web/components/command-bar";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Toaster } from "@leuchtturm/web/components/ui/sonner";
import { CommandBarProvider } from "@leuchtturm/web/contexts/command-bar";
import { sessionQuery } from "@leuchtturm/web/queries/session";
import type { RouterContext } from "@leuchtturm/web/router";

function RootErrorView() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div role="alert" className="flex min-h-svh w-full flex-col items-center justify-center gap-4">
			<div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
				<AlertCircleIcon className="text-destructive size-6" />
			</div>
			<h1 className="text-xl font-semibold">{t("Something went wrong")}</h1>
			<p className="text-muted-foreground max-w-md text-center text-sm">{t("Please try again.")}</p>
			<Button variant="outline" onClick={() => router.invalidate()}>
				{t("Try again")}
			</Button>
		</div>
	);
}

function RootErrorComponent(_props: ErrorComponentProps) {
	return <RootErrorView />;
}

function RootBoundaryFallback(_props: PostHogErrorBoundaryFallbackProps) {
	return <RootErrorView />;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: function Root() {
		const posthog = usePostHog();
		const { data: session } = useQuery(sessionQuery());

		useEffect(() => {
			if (session === undefined) {
				return;
			}

			if (!session) {
				posthog.reset();
				return;
			}

			posthog.identify(session.user.id, {
				email: session.user.email,
				name: session.user.name,
			});
		}, [posthog, session]);

		return (
			<I18nextProvider i18n={i18n}>
				<PostHogErrorBoundary
					fallback={RootBoundaryFallback}
					additionalProperties={{ source: "root-error-boundary" }}
				>
					<CommandBarProvider>
						<Toaster />
						<CommandBar />
						<Outlet />
						<TanStackDevtools
							plugins={[
								{
									name: "TanStack Router",
									render: <TanStackRouterDevtoolsPanel />,
								},
								{
									name: "TanStack Query",
									render: <ReactQueryDevtoolsPanel />,
								},
								formDevtoolsPlugin(),
								pacerDevtoolsPlugin(),
							]}
						/>
					</CommandBarProvider>
				</PostHogErrorBoundary>
			</I18nextProvider>
		);
	},
	errorComponent: RootErrorComponent,
});
