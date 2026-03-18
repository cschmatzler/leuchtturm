import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { useReactQueryMock } = vi.hoisted(() => ({
	useReactQueryMock: vi.fn(),
}));

vi.mock("@chevrotain/web/lib/query", () => ({
	useReactQuery: useReactQueryMock,
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (value: string) => value }),
}));

vi.mock("@chevrotain/web/components/ui/button", () => ({
	Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock("@tanstack/react-router", async () => {
	const actual =
		await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");

	return {
		...actual,
		Link: ({
			children,
			to,
			className,
		}: {
			children?: ReactNode;
			to: string;
			className?: string;
		}) => (
			<a href={to} className={className}>
				{children}
			</a>
		),
	};
});

import { MarketingHeader } from "@chevrotain/web/components/app/marketing-header";

describe("MarketingHeader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("shows anonymous actions when there is no session", () => {
		useReactQueryMock.mockReturnValue({
			data: null,
			isLoading: false,
		});

		render(<MarketingHeader />);

		expect(screen.queryByText("Dashboard")).toBeNull();
		expect(screen.queryByText("Login")).not.toBeNull();
		expect(screen.queryByText("Sign Up")).not.toBeNull();
	});

	it("shows the dashboard action only when a user is present", () => {
		useReactQueryMock.mockReturnValue({
			data: { session: { token: "session-token" }, user: { id: "user-1" } },
			isLoading: false,
		});

		render(<MarketingHeader />);

		expect(screen.queryByText("Dashboard")).not.toBeNull();
		expect(screen.queryByText("Login")).toBeNull();
	});
});
