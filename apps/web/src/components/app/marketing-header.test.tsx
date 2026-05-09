import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { GTProvider } from "gt-react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { MarketingHeader } from "@leuchtturm/web/components/app/marketing-header";

async function renderMarketingHeader(session: unknown) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				refetchOnMount: false,
			},
		},
	});
	queryClient.setQueryData(["session"], session);

	const Empty = () => null;
	const rootRoute = createRootRoute({
		component: () => (
			<GTProvider>
				<Outlet />
			</GTProvider>
		),
	});
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: MarketingHeader,
	});
	const loginRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/login",
		component: Empty,
	});
	const signupRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/signup",
		component: Empty,
	});
	const appRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/app",
		component: Empty,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([indexRoute, loginRoute, signupRoute, appRoute]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});

	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router as never} />
		</QueryClientProvider>,
	);
}

describe("MarketingHeader", () => {
	afterEach(() => {
		cleanup();
	});

	it("shows anonymous actions when there is no session", async () => {
		await renderMarketingHeader(null);

		await screen.findByText("Login");
		await screen.findByText("Sign Up");
		expect(screen.queryByText("Dashboard")).toBeNull();
	});

	it("shows the dashboard action only when a user is present", async () => {
		await renderMarketingHeader({
			session: { token: "session-token" },
			user: { id: "user-1" },
		});

		await screen.findByText("Dashboard");
		expect(screen.queryByText("Login")).toBeNull();
	});
});
