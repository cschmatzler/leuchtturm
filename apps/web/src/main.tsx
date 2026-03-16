import "@roasted/web/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { trackPageView } from "@roasted/web/lib/analytics";
import { createRouter, type RouterContext } from "@roasted/web/router";

const queryClient = new QueryClient();
const router = createRouter();

router.subscribe("onResolved", (event) => {
	if (!event.pathChanged && !event.hrefChanged) {
		return;
	}

	trackPageView(event.toLocation.href, event.fromLocation?.href ?? "");
});

createRoot(document.getElementById("root")!).render(<Router />);

function Router() {
	const routerContext: RouterContext = {
		...router.options.context,
		queryClient,
	};

	return (
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} context={routerContext} />
			</QueryClientProvider>
		</StrictMode>
	);
}
