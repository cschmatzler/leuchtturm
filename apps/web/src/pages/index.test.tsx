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
import { createInstance } from "i18next";
import type { ReactElement } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Route } from "@chevrotain/web/pages/index";

async function createTestI18n() {
	const i18n = createInstance();
	await i18n.use(initReactI18next).init({
		lng: "en",
		fallbackLng: "en",
		resources: {},
		keySeparator: false,
		interpolation: {
			escapeValue: false,
		},
	});
	return i18n;
}

async function renderHomePage(session: unknown) {
	const i18n = await createTestI18n();
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
			<I18nextProvider i18n={i18n}>
				<Outlet />
			</I18nextProvider>
		),
	});
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: Page as never,
	});
	const appRoute = createRoute({ getParentRoute: () => rootRoute, path: "/app", component: Empty });
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

		await screen.findByText("Start Logging");
		await screen.findAllByText("Sign Up");
		expect(screen.queryByText("Go to Dashboard")).toBeNull();
		expect(screen.queryAllByText("Login")).toHaveLength(3);
		expect(screen.queryAllByText("Sign Up")).toHaveLength(2);
	});

	it("shows dashboard CTAs when a user is present", async () => {
		await renderHomePage({
			session: { token: "session-token" },
			user: { id: "user-1" },
		});

		await screen.findAllByText("Go to Dashboard");
		expect(screen.queryAllByText("Go to Dashboard")).toHaveLength(2);
		expect(screen.queryByText("Start Logging")).toBeNull();
	});
});
