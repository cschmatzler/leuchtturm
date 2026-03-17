import { describe, expect, it } from "vite-plus/test";

import {
	createDateFilterValue,
	createDateRange,
	createNumberFilterValue,
	createNumberRange,
} from "@chevrotain/web/components/data-table-filter/helpers";

describe("createNumberFilterValue", () => {
	it("returns empty array for undefined", () => {
		expect(createNumberFilterValue(undefined)).toEqual([]);
	});

	it("returns empty array for empty array", () => {
		expect(createNumberFilterValue([])).toEqual([]);
	});

	it("returns single element array unchanged", () => {
		expect(createNumberFilterValue([5])).toEqual([5]);
	});

	it("sorts two values into ascending order", () => {
		expect(createNumberFilterValue([10, 5])).toEqual([5, 10]);
	});

	it("keeps two values in order if already sorted", () => {
		expect(createNumberFilterValue([5, 10])).toEqual([5, 10]);
	});

	it("only uses first two values from larger array", () => {
		expect(createNumberFilterValue([10, 5, 20])).toEqual([10, 5]);
	});
});

describe("createDateFilterValue", () => {
	const earlier = new Date("2024-01-01");
	const later = new Date("2024-12-31");

	it("returns empty array for undefined", () => {
		expect(createDateFilterValue(undefined)).toEqual([]);
	});

	it("returns empty array for empty array", () => {
		expect(createDateFilterValue([])).toEqual([]);
	});

	it("returns single date unchanged", () => {
		expect(createDateFilterValue([earlier])).toEqual([earlier]);
	});

	it("sorts two dates into chronological order", () => {
		expect(createDateFilterValue([later, earlier])).toEqual([earlier, later]);
	});

	it("keeps two dates in order if already sorted", () => {
		expect(createDateFilterValue([earlier, later])).toEqual([earlier, later]);
	});
});

describe("createDateRange", () => {
	const earlier = new Date("2024-01-01");
	const later = new Date("2024-12-31");

	it("returns dates in chronological order when first is earlier", () => {
		expect(createDateRange([earlier, later])).toEqual([earlier, later]);
	});

	it("swaps dates when first is later", () => {
		expect(createDateRange([later, earlier])).toEqual([earlier, later]);
	});

	it("handles same date", () => {
		const date = new Date("2024-06-15");
		const result = createDateRange([date, date]);
		expect(result[0]).toEqual(date);
		expect(result[1]).toEqual(date);
	});
});

describe("createNumberRange", () => {
	it("returns [0, 0] for undefined", () => {
		expect(createNumberRange(undefined)).toEqual([0, 0]);
	});

	it("returns [0, 0] for empty array", () => {
		expect(createNumberRange([])).toEqual([0, 0]);
	});

	it("returns [a, 0] sorted for single value", () => {
		expect(createNumberRange([5])).toEqual([0, 5]);
	});

	it("returns values in ascending order", () => {
		expect(createNumberRange([10, 5])).toEqual([5, 10]);
	});

	it("keeps values in order if already sorted", () => {
		expect(createNumberRange([5, 10])).toEqual([5, 10]);
	});

	it("handles negative numbers", () => {
		expect(createNumberRange([-5, -10])).toEqual([-10, -5]);
	});

	it("handles mixed positive and negative", () => {
		expect(createNumberRange([5, -5])).toEqual([-5, 5]);
	});

	it("handles equal values", () => {
		expect(createNumberRange([5, 5])).toEqual([5, 5]);
	});
});
