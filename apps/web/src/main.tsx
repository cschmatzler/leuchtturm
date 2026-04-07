import "@chevrotain/web/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createRouter, type RouterContext } from "@chevrotain/web/router";

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
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} context={routerContext} />
			</QueryClientProvider>
		</StrictMode>
	);
}
