import "@leuchtturm/web/index.css";
import { PostHogProvider } from "@posthog/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createRouter, type RouterContext } from "@leuchtturm/web/router";

const queryClient = new QueryClient();
const router = createRouter();

createRoot(document.getElementById("root")!).render(<Router />);

function Router() {
	const routerContext: RouterContext = {
		...router.options.context,
		queryClient,
	};

	return (
		<StrictMode>
			<PostHogProvider
				apiKey={import.meta.env.VITE_POSTHOG_KEY}
				options={{
					api_host: import.meta.env.VITE_POSTHOG_HOST,
					capture_pageview: "history_change",
					capture_pageleave: true,
					capture_exceptions: true,
				}}
			>
				<QueryClientProvider client={queryClient}>
					<RouterProvider router={router} context={routerContext} />
				</QueryClientProvider>
			</PostHogProvider>
		</StrictMode>
	);
}
