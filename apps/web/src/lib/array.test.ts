import { describe, expect, it } from "vite-plus/test";

import { addUniq, isAnyOf, removeUniq, uniq } from "@chevrotain/web/lib/array";

describe("uniq", () => {
	describe("primitives", () => {
		it("removes duplicates and preserves order", () => {
			expect(uniq([3, 1, 2, 1, 3, 2])).toEqual([3, 1, 2]);
		});

		it("handles null and undefined separately", () => {
			expect(uniq([null, undefined, null, undefined])).toEqual([null, undefined]);
		});
	});

	describe("objects", () => {
		it("removes duplicate objects with same properties", () => {
			const result = uniq([{ a: 1 }, { a: 1 }, { a: 2 }]);
			expect(result).toEqual([{ a: 1 }, { a: 2 }]);
		});

		it("considers objects with different property order as equal", () => {
			const result = uniq([
				{ a: 1, b: 2 },
				{ b: 2, a: 1 },
			]);
			expect(result).toEqual([{ a: 1, b: 2 }]);
		});

		it("handles nested objects", () => {
			const result = uniq([{ nested: { a: 1 } }, { nested: { a: 1 } }, { nested: { a: 2 } }]);
			expect(result).toEqual([{ nested: { a: 1 } }, { nested: { a: 2 } }]);
		});

		it("distinguishes objects with different values", () => {
			const result = uniq([
				{ a: 1, b: 2 },
				{ a: 1, b: 3 },
			]);
			expect(result).toEqual([
				{ a: 1, b: 2 },
				{ a: 1, b: 3 },
			]);
		});

		it("distinguishes objects with different keys", () => {
			const result = uniq([{ a: 1 }, { b: 1 }]);
			expect(result).toEqual([{ a: 1 }, { b: 1 }]);
		});
	});

	describe("arrays", () => {
		it("removes duplicate arrays", () => {
			const result = uniq([
				[1, 2],
				[1, 2],
				[2, 1],
			]);
			expect(result).toEqual([
				[1, 2],
				[2, 1],
			]);
		});

		it("handles nested arrays", () => {
			const result = uniq([
				[1, [2, 3]],
				[1, [2, 3]],
			]);
			expect(result).toEqual([[1, [2, 3]]]);
		});

		it("distinguishes arrays of different lengths", () => {
			const result = uniq([
				[1, 2],
				[1, 2, 3],
				[1, 2],
			]);
			expect(result).toEqual([
				[1, 2],
				[1, 2, 3],
			]);
		});
	});

	describe("mixed types", () => {
		it("distinguishes between different types with same string representation", () => {
			const result = uniq([1, "1", true, "true"]);
			expect(result).toEqual([1, "1", true, "true"]);
		});

		it("handles array with mixed primitives and objects", () => {
			const result = uniq([1, { a: 1 }, 1, { a: 1 }, "1"]);
			expect(result).toEqual([1, { a: 1 }, "1"]);
		});
	});

	describe("edge cases", () => {
		it("handles functions (by reference, but hashed by toString)", () => {
			const fn1 = () => 1;
			const fn2 = () => 1;
			const result = uniq([fn1, fn2, fn1]);
			expect(result.length).toBeLessThanOrEqual(2);
		});

		it("handles objects with circular-like structure via cache", () => {
			const obj1 = { a: 1 };
			const obj2 = { ref: obj1 };
			const result = uniq([obj2, obj2, { ref: { a: 1 } }]);
			expect(result).toEqual([{ ref: { a: 1 } }]);
		});
	});
});

describe("addUniq", () => {
	it("adds new unique values to array", () => {
		expect(addUniq([1, 2], [3, 4])).toEqual([1, 2, 3, 4]);
	});

	it("does not add duplicate values", () => {
		expect(addUniq([1, 2], [2, 3])).toEqual([1, 2, 3]);
	});

	it("handles empty source array", () => {
		expect(addUniq([], [1, 2])).toEqual([1, 2]);
	});

	it("handles empty values array", () => {
		expect(addUniq([1, 2], [])).toEqual([1, 2]);
	});

	it("works with objects", () => {
		expect(addUniq([{ a: 1 }], [{ a: 1 }, { a: 2 }])).toEqual([{ a: 1 }, { a: 2 }]);
	});
});

describe("removeUniq", () => {
	it("removes specified values from array", () => {
		expect(removeUniq([1, 2, 3, 4], [2, 4])).toEqual([1, 3]);
	});

	it("uses reference equality for objects", () => {
		const obj = { a: 1 };
		expect(removeUniq([obj, { a: 2 }], [obj])).toEqual([{ a: 2 }]);
	});
});

describe("isAnyOf", () => {
	it("returns true when value is in the list", () => {
		expect(isAnyOf("active", ["active", "pending"])).toBe(true);
	});

	it("returns false when value is not in the list", () => {
		expect(isAnyOf("archived", ["active", "pending"])).toBe(false);
	});

	it("returns false for an empty list", () => {
		expect(isAnyOf("active", [])).toBe(false);
	});

	it("uses strict equality", () => {
		expect(isAnyOf(1, [1, 2, 3])).toBe(true);
		expect(isAnyOf("1", [1, 2, 3] as unknown[])).toBe(false);
	});
});
