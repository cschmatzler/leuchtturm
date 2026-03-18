import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const {
	navigateMock,
	invalidateMock,
	signOutMock,
	listDeviceSessionsMock,
	revokeSessionMock,
	setActiveSessionMock,
} = vi.hoisted(() => ({
	navigateMock: vi.fn(),
	invalidateMock: vi.fn(),
	signOutMock: vi.fn(),
	listDeviceSessionsMock: vi.fn(),
	revokeSessionMock: vi.fn(),
	setActiveSessionMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual =
		await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");

	return {
		...actual,
		useNavigate: () => navigateMock,
		useRouter: () => ({ invalidate: invalidateMock }),
	};
});

vi.mock("@chevrotain/web/clients/auth", () => ({
	authClient: {
		signOut: signOutMock,
		multiSession: {
			listDeviceSessions: listDeviceSessionsMock,
			revoke: revokeSessionMock,
			setActive: setActiveSessionMock,
		},
	},
}));

import { useAuth } from "@chevrotain/web/hooks/use-auth";

describe("useAuth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("clears cached auth state before invalidating and navigating on sign out", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(["session"], {
			session: { token: "session-token" },
			user: { id: "user-1" },
		});
		queryClient.setQueryData(["deviceSessions"], [{ session: { token: "session-token" } }]);

		signOutMock.mockResolvedValue(undefined);
		invalidateMock.mockImplementation(async () => {
			expect(queryClient.getQueryData(["session"])).toBeNull();
			expect(queryClient.getQueryData(["deviceSessions"])).toBeUndefined();
		});
		navigateMock.mockImplementation(() => {
			expect(queryClient.getQueryData(["session"])).toBeNull();
			expect(queryClient.getQueryData(["deviceSessions"])).toBeUndefined();
		});

		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useAuth(), { wrapper });

		await result.current.signOut();

		expect(signOutMock).toHaveBeenCalledTimes(1);
		expect(invalidateMock).toHaveBeenCalledTimes(1);
		expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
	});

	it("revokes all device sessions and clears cached auth state on sign out all", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(["session"], {
			session: { token: "session-token" },
			user: { id: "user-1" },
		});
		queryClient.setQueryData(["deviceSessions"], [{ session: { token: "session-token" } }]);

		listDeviceSessionsMock.mockResolvedValue({
			data: [{ session: { token: "session-a" } }, { session: { token: "session-b" } }],
		});
		revokeSessionMock.mockResolvedValue(undefined);
		signOutMock.mockResolvedValue(undefined);
		invalidateMock.mockImplementation(async () => {
			expect(queryClient.getQueryData(["session"])).toBeNull();
			expect(queryClient.getQueryData(["deviceSessions"])).toBeUndefined();
		});

		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useAuth(), { wrapper });

		await result.current.signOutAll();

		expect(listDeviceSessionsMock).toHaveBeenCalledTimes(1);
		expect(revokeSessionMock).toHaveBeenNthCalledWith(1, { sessionToken: "session-a" });
		expect(revokeSessionMock).toHaveBeenNthCalledWith(2, { sessionToken: "session-b" });
		expect(signOutMock).toHaveBeenCalledTimes(1);
		expect(invalidateMock).toHaveBeenCalledTimes(1);
		expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
	});
});
