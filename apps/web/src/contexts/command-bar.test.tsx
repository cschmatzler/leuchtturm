import { act, renderHook } from "@testing-library/react";
import type { FC, ReactNode } from "react";
import { useContext } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { Action } from "@one/web/contexts/command-bar";
import { CommandBarProvider, Context } from "@one/web/contexts/command-bar";

const Icon: FC<{ className?: string }> = () => null;

const createAction = (overrides: Partial<Action> = {}): Action => ({
	title: "Action",
	category: "General",
	icon: Icon,
	run: vi.fn(),
	...overrides,
});

const createWrapper =
	() =>
	({ children }: { children: ReactNode }) => <CommandBarProvider>{children}</CommandBarProvider>;

const useCommandBarValue = () => {
	const context = useContext(Context);
	if (!context) {
		throw new Error("Missing CommandBar context");
	}
	return context;
};

describe("CommandBarProvider", () => {
	it("shows actions from requested providers", async () => {
		const action = createAction({ title: "Open" });
		const provider = vi.fn(async () => {
			return [action];
		});

		const { result } = renderHook(() => useCommandBarValue(), { wrapper: createWrapper() });

		act(() => {
			result.current.register("actions", provider);
		});

		await act(async () => {
			await result.current.show("actions");
		});

		expect(provider).toHaveBeenCalledWith("");
		expect(result.current.visible).toBe(true);
		expect(result.current.categories).toEqual({ General: [action] });
	});

	it("filters to global actions when no providers are specified", async () => {
		const localAction = createAction({ title: "Local", global: false });
		const globalAction = createAction({ title: "Global", global: true });
		const provider = vi.fn(async () => [localAction, globalAction]);

		const { result } = renderHook(() => useCommandBarValue(), { wrapper: createWrapper() });

		act(() => {
			result.current.register("actions", provider);
		});

		await act(async () => {
			await result.current.show();
		});

		expect(result.current.categories).toEqual({ General: [globalAction] });
	});

	it("refreshes actions when input changes while visible", async () => {
		const provider = vi.fn(async (input: string) => [
			createAction({ title: `Search ${input}`, value: input, global: true }),
		]);

		const { result } = renderHook(() => useCommandBarValue(), { wrapper: createWrapper() });

		act(() => {
			result.current.register("search", provider);
		});

		await act(async () => {
			await result.current.show("search");
		});

		await act(async () => {
			result.current.setInput("brew");
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		expect(provider).toHaveBeenNthCalledWith(1, "");
		expect(provider).toHaveBeenNthCalledWith(2, "brew");
		expect(result.current.categories.General?.[0]?.value).toBe("brew");
	});

	it("filters out disabled actions", async () => {
		const enabledAction = createAction({ title: "Enabled", global: true });
		const disabledAction = createAction({ title: "Disabled", disabled: true, global: true });
		const provider = vi.fn(async () => [enabledAction, disabledAction]);

		const { result } = renderHook(() => useCommandBarValue(), { wrapper: createWrapper() });

		act(() => {
			result.current.register("actions", provider);
		});

		await act(async () => {
			await result.current.show("actions");
		});

		expect(result.current.categories).toEqual({ General: [enabledAction] });
	});

	it("does not register the same provider twice", async () => {
		const action = createAction({ title: "Unique" });
		const provider = vi.fn(async () => [action]);

		const { result } = renderHook(() => useCommandBarValue(), { wrapper: createWrapper() });

		act(() => {
			result.current.register("actions", provider);
			result.current.register("actions", provider);
		});

		await act(async () => {
			await result.current.show("actions");
		});

		expect(provider).toHaveBeenCalledTimes(1);
		expect(result.current.categories).toEqual({ General: [action] });
	});

	it("hides the command bar", async () => {
		const action = createAction({ title: "Test", global: true });
		const provider = vi.fn(async () => [action]);

		const { result } = renderHook(() => useCommandBarValue(), { wrapper: createWrapper() });

		act(() => {
			result.current.register("actions", provider);
		});

		await act(async () => {
			await result.current.show("actions");
		});
		expect(result.current.visible).toBe(true);

		act(() => {
			result.current.hide();
		});
		expect(result.current.visible).toBe(false);
	});

	it("toggles visibility", () => {
		const { result } = renderHook(() => useCommandBarValue(), { wrapper: createWrapper() });

		act(() => {
			result.current.toggle(true);
		});
		expect(result.current.visible).toBe(true);

		act(() => {
			result.current.toggle(false);
		});
		expect(result.current.visible).toBe(false);
	});

	it("unregisters a provider via the cleanup function", async () => {
		const action = createAction({ title: "Removable" });
		const provider = vi.fn(async () => [action]);

		const { result } = renderHook(() => useCommandBarValue(), { wrapper: createWrapper() });

		let unregister: () => void;
		act(() => {
			unregister = result.current.register("actions", provider);
		});

		act(() => {
			unregister();
		});

		await act(async () => {
			await result.current.show("actions");
		});

		expect(provider).not.toHaveBeenCalled();
	});

	it("warns when showing an unknown provider", async () => {
		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const { result } = renderHook(() => useCommandBarValue(), { wrapper: createWrapper() });

		await act(async () => {
			await result.current.show("nonexistent");
		});

		expect(consoleWarnSpy).toHaveBeenCalledWith('Command bar provider "nonexistent" not found');
		consoleWarnSpy.mockRestore();
	});
});
