import { TanStackDevtools } from "@tanstack/react-devtools";
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools";
import { pacerDevtoolsPlugin } from "@tanstack/react-pacer-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	type ErrorComponentProps,
	Outlet,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { AlertCircleIcon } from "lucide-react";
import { I18nextProvider, useTranslation } from "react-i18next";

import { i18n } from "@chevrotain/web/clients/i18n";
import { CommandBar } from "@chevrotain/web/components/command-bar";
import { Button } from "@chevrotain/web/components/ui/button";
import { Toaster } from "@chevrotain/web/components/ui/sonner";
import { CommandBarProvider } from "@chevrotain/web/contexts/command-bar";
import type { RouterContext } from "@chevrotain/web/router";

function RootErrorComponent({ error }: ErrorComponentProps) {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div role="alert" className="flex min-h-svh w-full flex-col items-center justify-center gap-4">
			<div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
				<AlertCircleIcon className="text-destructive size-6" />
			</div>
			<h1 className="text-xl font-semibold">{t("Something went wrong")}</h1>
			<p className="text-muted-foreground max-w-md text-center text-sm">{error.message}</p>
			<Button variant="outline" onClick={() => router.invalidate()}>
				{t("Try again")}
			</Button>
		</div>
	);
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: () => {
		return (
			<I18nextProvider i18n={i18n}>
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-ring"
				>
					Skip to content
				</a>
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
			</I18nextProvider>
		);
	},
	errorComponent: RootErrorComponent,
});
