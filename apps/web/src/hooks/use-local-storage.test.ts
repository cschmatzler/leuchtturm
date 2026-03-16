import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useLocalStorage } from "@one/web/hooks/use-local-storage";

describe("useLocalStorage", () => {
	let localStorageMock: Storage;

	beforeEach(() => {
		localStorageMock = {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn(),
			key: vi.fn(),
			length: 0,
		};
		Object.defineProperty(window, "localStorage", {
			value: localStorageMock,
			writable: true,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("initialization", () => {
		it("returns default value when localStorage is empty", () => {
			vi.mocked(localStorageMock.getItem).mockReturnValue(null);

			const { result } = renderHook(() => useLocalStorage("test-key", "default-value"));

			expect(result.current[0]).toBe("default-value");
			expect(localStorageMock.getItem).toHaveBeenCalledWith("test-key");
		});

		it("returns parsed value from localStorage when present", () => {
			vi.mocked(localStorageMock.getItem).mockReturnValue(JSON.stringify("stored-value"));

			const { result } = renderHook(() => useLocalStorage("test-key", "default-value"));

			expect(result.current[0]).toBe("stored-value");
		});

		it("handles complex objects", () => {
			const storedObject = { name: "test", count: 42 };
			vi.mocked(localStorageMock.getItem).mockReturnValue(JSON.stringify(storedObject));

			const { result } = renderHook(() => useLocalStorage("test-key", { name: "", count: 0 }));

			expect(result.current[0]).toEqual(storedObject);
		});

		it("does not write default value to localStorage on mount", () => {
			vi.mocked(localStorageMock.getItem).mockReturnValue(null);

			renderHook(() => useLocalStorage("test-key", "default-value"));

			expect(localStorageMock.setItem).not.toHaveBeenCalled();
		});
	});

	describe("setValue", () => {
		it("updates state with direct value", async () => {
			vi.mocked(localStorageMock.getItem).mockReturnValue(null);

			const { result } = renderHook(() => useLocalStorage("test-key", "initial"));

			act(() => {
				result.current[1]("new-value");
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			expect(result.current[0]).toBe("new-value");
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				"test-key",
				JSON.stringify("new-value"),
			);
		});

		it("updates state with function updater", async () => {
			vi.mocked(localStorageMock.getItem).mockReturnValue(null);

			const { result } = renderHook(() => useLocalStorage("test-key", 0));

			act(() => {
				result.current[1]((prev) => prev + 1);
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			expect(result.current[0]).toBe(1);
			expect(localStorageMock.setItem).toHaveBeenCalledWith("test-key", JSON.stringify(1));
		});

		it("handles multiple updates", async () => {
			vi.mocked(localStorageMock.getItem).mockReturnValue(null);

			const { result } = renderHook(() => useLocalStorage("test-key", 0));

			act(() => {
				result.current[1](1);
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			act(() => {
				result.current[1]((prev) => prev + 10);
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			expect(result.current[0]).toBe(11);
			expect(localStorageMock.setItem).toHaveBeenLastCalledWith("test-key", JSON.stringify(11));
		});
	});

	describe("custom serialization", () => {
		it("uses custom serialize function", async () => {
			vi.mocked(localStorageMock.getItem).mockReturnValue(null);
			const customSerialize = vi.fn((value: number) => `custom:${value}`);

			const { result } = renderHook(() =>
				useLocalStorage<number>("test-key", 42, { serialize: customSerialize }),
			);

			act(() => {
				result.current[1](100);
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			expect(customSerialize).toHaveBeenCalledWith(100);
			expect(localStorageMock.setItem).toHaveBeenCalledWith("test-key", "custom:100");
		});

		it("uses custom deserialize function", () => {
			vi.mocked(localStorageMock.getItem).mockReturnValue("stored:123");
			const customDeserialize = vi.fn((value: string) =>
				parseInt(value.replace("stored:", ""), 10),
			);

			const { result } = renderHook(() =>
				useLocalStorage("test-key", 0, { deserialize: customDeserialize }),
			);

			expect(customDeserialize).toHaveBeenCalledWith("stored:123");
			expect(result.current[0]).toBe(123);
		});
	});

	describe("different key types", () => {
		it("works with boolean values", async () => {
			vi.mocked(localStorageMock.getItem).mockReturnValue(null);

			const { result } = renderHook(() => useLocalStorage("bool-key", false));

			act(() => {
				result.current[1](true);
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			expect(result.current[0]).toBe(true);
			expect(localStorageMock.setItem).toHaveBeenCalledWith("bool-key", "true");
		});

		it("works with array values", async () => {
			vi.mocked(localStorageMock.getItem).mockReturnValue(null);

			const { result } = renderHook(() => useLocalStorage("array-key", [] as string[]));

			act(() => {
				result.current[1](["a", "b", "c"]);
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			expect(result.current[0]).toEqual(["a", "b", "c"]);
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				"array-key",
				JSON.stringify(["a", "b", "c"]),
			);
		});
	});
});
