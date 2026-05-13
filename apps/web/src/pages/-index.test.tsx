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
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Route } from "@leuchtturm/web/pages/index";

async function renderHomePage(session: unknown) {
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
	const Page = Route.options.component as () => ReactElement;
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
		component: Page as never,
	});
	const appRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/app",
		component: Empty,
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
	const tosRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/terms-of-service",
		component: Empty,
	});
	const privacyRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/privacy-policy",
		component: Empty,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			indexRoute,
			appRoute,
			loginRoute,
			signupRoute,
			tosRoute,
			privacyRoute,
		]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});

	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router as never} />
		</QueryClientProvider>,
	);
}

describe("home page auth CTAs", () => {
	afterEach(() => {
		cleanup();
	});

	it("keeps anonymous CTAs when there is no session", async () => {
		await renderHomePage(null);

		await screen.findByText("Get Started");
		await screen.findAllByText("Sign Up");
		expect(screen.queryByText("Go to Dashboard")).toBeNull();
		expect(screen.queryAllByText("Login")).toHaveLength(4);
		expect(screen.queryAllByText("Sign Up")).toHaveLength(3);
	});

	it("shows dashboard CTAs when a user is present", async () => {
		await renderHomePage({
			session: { token: "session-token" },
			user: { id: "user-1" },
		});

		await screen.findAllByText("Go to Dashboard");
		expect(screen.queryAllByText("Go to Dashboard")).toHaveLength(2);
		expect(screen.queryByText("Get Started")).toBeNull();

		const dashboardLinks = screen.getAllByRole("link", { name: /dashboard/i });
		expect(dashboardLinks).toHaveLength(4);
		expect(dashboardLinks.every((link) => link.getAttribute("href") === "/app")).toBe(true);
	});
});
