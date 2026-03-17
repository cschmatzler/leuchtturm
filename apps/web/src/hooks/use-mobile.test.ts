import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useIsMobile } from "@chevrotain/web/hooks/use-mobile";

type MatchMediaHandle = {
	addEventListener: ReturnType<typeof vi.fn>;
	removeEventListener: ReturnType<typeof vi.fn>;
	trigger: () => void;
};

const MOBILE_BREAKPOINT = 768;

describe("useIsMobile", () => {
	let originalMatchMedia: typeof window.matchMedia;

	beforeEach(() => {
		originalMatchMedia = window.matchMedia;
	});

	afterEach(() => {
		window.matchMedia = originalMatchMedia;
	});

	const setupMatchMedia = (): MatchMediaHandle => {
		let handler: ((event: MediaQueryListEvent) => void) | null = null;
		const addEventListener = vi.fn((event: string, next: (event: MediaQueryListEvent) => void) => {
			if (event === "change") {
				handler = next;
			}
		});
		const removeEventListener = vi.fn(
			(event: string, next: (event: MediaQueryListEvent) => void) => {
				if (event === "change" && handler === next) {
					handler = null;
				}
			},
		);

		const addListener = vi.fn();
		const removeListener = vi.fn();
		const dispatchEvent = vi.fn(() => false);
		window.matchMedia = vi.fn((query: string) => ({
			matches: window.innerWidth < MOBILE_BREAKPOINT,
			media: query,
			onchange: null,
			addListener,
			removeListener,
			addEventListener,
			removeEventListener,
			dispatchEvent,
		})) as unknown as typeof window.matchMedia;

		return {
			addEventListener,
			removeEventListener,
			trigger: () => handler?.({} as MediaQueryListEvent),
		};
	};

	it("reflects viewport size and updates on change", async () => {
		window.innerWidth = MOBILE_BREAKPOINT - 10;
		const { trigger } = setupMatchMedia();

		const { result } = renderHook(() => useIsMobile());

		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		expect(result.current).toBe(true);

		act(() => {
			window.innerWidth = MOBILE_BREAKPOINT + 200;
			trigger();
		});

		expect(result.current).toBe(false);
	});

	it("cleans up the matchMedia listener", async () => {
		window.innerWidth = MOBILE_BREAKPOINT - 1;
		const { addEventListener, removeEventListener } = setupMatchMedia();

		const { unmount } = renderHook(() => useIsMobile());

		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

		unmount();

		expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
	});
});
