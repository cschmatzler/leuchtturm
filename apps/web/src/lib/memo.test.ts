import { describe, expect, it, vi } from "vite-plus/test";

import { memo } from "@leuchtturm/web/lib/memo";

describe("memo", () => {
	describe("caching behavior", () => {
		it("returns cached result when dependencies are unchanged", () => {
			const compute = vi.fn((deps: readonly [number]) => deps[0] * 2);
			let value = 5;

			const memoized = memo(() => [value] as const, compute);

			expect(memoized()).toBe(10);
			expect(memoized()).toBe(10);
			expect(memoized()).toBe(10);

			expect(compute).toHaveBeenCalledTimes(1);
		});

		it("recomputes when dependencies change", () => {
			const compute = vi.fn((deps: readonly [number]) => deps[0] * 2);
			let value = 5;

			const memoized = memo(() => [value] as const, compute);

			expect(memoized()).toBe(10);
			expect(compute).toHaveBeenCalledTimes(1);

			value = 10;
			expect(memoized()).toBe(20);
			expect(compute).toHaveBeenCalledTimes(2);
		});

		it("caches after dependency change", () => {
			const compute = vi.fn((deps: readonly [number]) => deps[0] * 2);
			let value = 5;

			const memoized = memo(() => [value] as const, compute);

			memoized();
			value = 10;
			memoized();
			memoized();
			memoized();

			expect(compute).toHaveBeenCalledTimes(2);
		});
	});

	describe("multiple dependencies", () => {
		it("recomputes when any dependency changes", () => {
			const compute = vi.fn((deps: readonly [number, string]) => `${deps[1]}-${deps[0]}`);
			let num = 1;
			let str = "a";

			const memoized = memo(() => [num, str] as const, compute);

			expect(memoized()).toBe("a-1");
			expect(compute).toHaveBeenCalledTimes(1);

			num = 2;
			expect(memoized()).toBe("a-2");
			expect(compute).toHaveBeenCalledTimes(2);

			str = "b";
			expect(memoized()).toBe("b-2");
			expect(compute).toHaveBeenCalledTimes(3);
		});

		it("does not recompute when no dependencies change", () => {
			const compute = vi.fn((deps: readonly [number, string, boolean]) => deps);
			const num = 1;
			const str = "a";
			const bool = true;

			const memoized = memo(() => [num, str, bool] as const, compute);

			memoized();
			memoized();
			memoized();

			expect(compute).toHaveBeenCalledTimes(1);
		});
	});

	describe("shallow equality", () => {
		it("treats different array references with same values as equal", () => {
			const compute = vi.fn((deps: readonly [number]) => deps[0]);

			const memoized = memo(() => [5] as const, compute);

			memoized();
			memoized();

			expect(compute).toHaveBeenCalledTimes(1);
		});

		it("treats different object references as different (shallow comparison)", () => {
			const compute = vi.fn((deps: readonly [{ a: number }]) => deps[0].a);
			let obj = { a: 1 };

			const memoized = memo(() => [obj] as const, compute);

			expect(memoized()).toBe(1);
			expect(compute).toHaveBeenCalledTimes(1);

			obj = { a: 1 };
			expect(memoized()).toBe(1);
			expect(compute).toHaveBeenCalledTimes(2);
		});

		it("treats same object reference as equal", () => {
			const compute = vi.fn((deps: readonly [{ a: number }]) => deps[0].a);
			const obj = { a: 1 };

			const memoized = memo(() => [obj] as const, compute);

			memoized();
			obj.a = 2;
			const result = memoized();

			expect(compute).toHaveBeenCalledTimes(1);
			expect(result).toBe(1);
		});
	});

	describe("edge cases", () => {
		it("handles empty dependencies array", () => {
			const compute = vi.fn(() => "constant");

			const memoized = memo(() => [] as const, compute);

			expect(memoized()).toBe("constant");
			expect(memoized()).toBe("constant");
			expect(compute).toHaveBeenCalledTimes(1);
		});

		it("handles null and undefined in dependencies", () => {
			const compute = vi.fn((deps: readonly [null, undefined]) => deps);
			const memoized = memo(() => [null, undefined] as const, compute);

			memoized();
			memoized();

			expect(compute).toHaveBeenCalledTimes(1);
		});

		it("distinguishes between null and undefined", () => {
			const compute = vi.fn((deps: readonly [null | undefined]) => deps[0]);
			let value: null | undefined = null;

			const memoized = memo(() => [value] as const, compute);

			expect(memoized()).toBe(null);
			expect(compute).toHaveBeenCalledTimes(1);

			value = undefined;
			expect(memoized()).toBe(undefined);
			expect(compute).toHaveBeenCalledTimes(2);
		});

		it("handles NaN correctly (NaN !== NaN triggers recompute)", () => {
			const compute = vi.fn((deps: readonly [number]) => deps[0]);

			const memoized = memo(() => [NaN] as const, compute);

			memoized();
			memoized();

			expect(compute).toHaveBeenCalledTimes(2);
		});
	});
});
