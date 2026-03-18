import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { getSessionMock } = vi.hoisted(() => ({
	getSessionMock: vi.fn(),
}));

vi.mock("@chevrotain/web/clients/auth", () => ({
	authClient: {
		getSession: getSessionMock,
		multiSession: {
			listDeviceSessions: vi.fn(),
		},
	},
}));

import { sessionQuery } from "@chevrotain/web/queries/session";

describe("sessionQuery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("treats session state as immediately stale", () => {
		expect(sessionQuery().staleTime).toBe(0);
	});

	it("normalizes missing sessions to null", async () => {
		getSessionMock.mockResolvedValue({ data: undefined });

		const queryClient = new QueryClient();
		const session = await queryClient.fetchQuery(sessionQuery());

		expect(session).toBeNull();
		expect(getSessionMock).toHaveBeenCalledTimes(1);
	});

	it("normalizes incomplete auth payloads to null", async () => {
		getSessionMock.mockResolvedValue({
			data: {
				session: null,
				user: null,
			},
		});

		const queryClient = new QueryClient();
		const session = await queryClient.fetchQuery(sessionQuery());

		expect(session).toBeNull();
		expect(getSessionMock).toHaveBeenCalledTimes(1);
	});
});
