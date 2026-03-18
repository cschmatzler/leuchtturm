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

vi.mock("@chevrotain/web/components/app/marketing-header", () => ({
	MarketingHeader: () => <div>Marketing Header</div>,
}));

vi.mock("@chevrotain/web/components/ui/button", () => ({
	Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock("@chevrotain/web/components/ui/badge", () => ({
	Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@chevrotain/web/components/ui/card", () => ({
	Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

import { Route } from "@chevrotain/web/pages/index";

describe("home page auth CTAs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("keeps anonymous CTAs when there is no session", () => {
		useReactQueryMock.mockReturnValue({
			data: null,
		});

		const Page = Route.options.component as () => ReactNode;
		render(<Page />);

		expect(screen.queryByText("Go to Dashboard")).toBeNull();
		expect(screen.queryByText("Start Logging")).not.toBeNull();
		expect(screen.queryAllByText("Login")).toHaveLength(2);
		expect(screen.queryByText("Sign Up")).not.toBeNull();
	});

	it("shows dashboard CTAs when a user is present", () => {
		useReactQueryMock.mockReturnValue({
			data: { session: { token: "session-token" }, user: { id: "user-1" } },
		});

		const Page = Route.options.component as () => ReactNode;
		render(<Page />);

		expect(screen.queryAllByText("Go to Dashboard")).toHaveLength(2);
		expect(screen.queryByText("Start Logging")).toBeNull();
	});
});
