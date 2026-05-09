import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
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
import { GTProvider, T } from "gt-react";
import { useEffect } from "react";

import { DEFAULT_LANGUAGE } from "@leuchtturm/core/i18n";
import { CommandBar } from "@leuchtturm/web/components/command-bar";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Toaster } from "@leuchtturm/web/components/ui/sonner";
import { CommandBarProvider } from "@leuchtturm/web/contexts/command-bar";
import { loadTranslations, translatedLocales } from "@leuchtturm/web/lib/translations";
import { sessionQuery } from "@leuchtturm/web/queries/session";
import type { RouterContext } from "@leuchtturm/web/router";

function RootErrorView() {
	const router = useRouter();

	return (
		<div role="alert" className="flex min-h-svh w-full flex-col items-center justify-center gap-4">
			<div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
				<WarningCircleIcon className="text-destructive size-6" />
			</div>
			<h1 className="text-xl font-semibold">
				<T>Something went wrong</T>
			</h1>
			<p className="text-muted-foreground max-w-md text-center text-sm">
				<T>Please try again.</T>
			</p>
			<Button variant="outline" onClick={() => router.invalidate()}>
				<T>Try again</T>
			</Button>
		</div>
	);
}

function RootErrorComponent(_props: ErrorComponentProps) {
	return (
		<GTProvider
			defaultLocale={DEFAULT_LANGUAGE}
			locales={translatedLocales}
			loadTranslations={loadTranslations}
		>
			<RootErrorView />
		</GTProvider>
	);
}

function RootBoundaryFallback(_props: PostHogErrorBoundaryFallbackProps) {
	return <RootErrorView />;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: function Root() {
		const posthog = usePostHog();
		const { data: session } = useQuery(sessionQuery());

		useEffect(() => {
			if (!session || !session.user) {
				posthog.reset();
				return;
			}

			posthog.identify(session.user.id, {
				email: session.user.email,
				name: session.user.name,
			});
		}, [posthog, session]);

		return (
			<GTProvider
				defaultLocale={DEFAULT_LANGUAGE}
				locales={translatedLocales}
				loadTranslations={loadTranslations}
			>
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
			</GTProvider>
		);
	},
	errorComponent: RootErrorComponent,
});
