import { describe, expect, it, vi } from "vite-plus/test";

const { redirectMock } = vi.hoisted(() => ({
	redirectMock: vi.fn((options: { to: string }) => ({ ...options, __redirect: true })),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual =
		await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");

	return {
		...actual,
		redirect: redirectMock,
	};
});

import { Route } from "@chevrotain/web/pages/app";

describe("/app route auth guard", () => {
	it("fetches the latest session and redirects to login when it is missing", async () => {
		const fetchQuery = vi.fn().mockResolvedValue(null);

		await expect(
			Route.options.beforeLoad?.({ context: { queryClient: { fetchQuery } } } as never),
		).rejects.toMatchObject({ __redirect: true, to: "/login" });

		expect(fetchQuery).toHaveBeenCalledTimes(1);
		expect(redirectMock).toHaveBeenCalledWith({ to: "/login" });
	});

	it("returns the fetched session when a user is present", async () => {
		const session = {
			session: { token: "session-token" },
			user: { id: "user-1" },
		};
		const fetchQuery = vi.fn().mockResolvedValue(session);

		await expect(
			Route.options.beforeLoad?.({ context: { queryClient: { fetchQuery } } } as never),
		).resolves.toEqual({ session });
	});
});
