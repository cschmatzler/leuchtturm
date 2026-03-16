import { describe, expect, it } from "vite-plus/test";

import {
	dateFilterFn,
	multiOptionFilterFn,
	numberFilterFn,
	optionFilterFn,
	textFilterFn,
} from "@one/web/components/data-table-filter/filter-fns";
import type { FilterModel } from "@one/web/components/data-table-filter/types";

const optionFilter = (
	operator: FilterModel<"option">["operator"],
	values: string[],
): FilterModel<"option"> => ({
	columnId: "test",
	type: "option",
	operator,
	values,
});

const multiOptionFilter = (
	operator: FilterModel<"multiOption">["operator"],
	values: string[],
): FilterModel<"multiOption"> => ({
	columnId: "test",
	type: "multiOption",
	operator,
	values,
});

const textFilter = (
	operator: FilterModel<"text">["operator"],
	values: string[],
): FilterModel<"text"> => ({
	columnId: "test",
	type: "text",
	operator,
	values,
});

const numberFilter = (
	operator: FilterModel<"number">["operator"],
	values: number[],
): FilterModel<"number"> => ({
	columnId: "test",
	type: "number",
	operator,
	values,
});

type DateFilterInput = NonNullable<Parameters<typeof dateFilterFn>[1]>;

const dateFilter = (
	operator: DateFilterInput["operator"],
	values: DateFilterInput["values"],
): DateFilterInput => ({
	operator,
	values,
});

describe("optionFilterFn", () => {
	it("returns false for empty input data", () => {
		expect(optionFilterFn("", optionFilter("is", ["active"]))).toBe(false);
	});

	it("returns true when values array is empty", () => {
		expect(optionFilterFn("active", optionFilter("is", []))).toBe(true);
	});

	describe("is operator", () => {
		it("returns true when value matches", () => {
			expect(optionFilterFn("active", optionFilter("is", ["active"]))).toBe(true);
		});

		it("returns false when value does not match", () => {
			expect(optionFilterFn("inactive", optionFilter("is", ["active"]))).toBe(false);
		});

		it("is case-insensitive", () => {
			expect(optionFilterFn("active", optionFilter("is", ["ACTIVE"]))).toBe(true);
		});
	});

	describe("is not operator", () => {
		it("returns true when value does not match", () => {
			expect(optionFilterFn("inactive", optionFilter("is not", ["active"]))).toBe(true);
		});

		it("returns false when value matches", () => {
			expect(optionFilterFn("active", optionFilter("is not", ["active"]))).toBe(false);
		});
	});

	describe("is any of operator", () => {
		it("returns true when value is in list", () => {
			expect(optionFilterFn("active", optionFilter("is any of", ["active", "pending"]))).toBe(true);
			expect(optionFilterFn("pending", optionFilter("is any of", ["active", "pending"]))).toBe(
				true,
			);
		});

		it("returns false when value is not in list", () => {
			expect(optionFilterFn("inactive", optionFilter("is any of", ["active", "pending"]))).toBe(
				false,
			);
		});
	});

	describe("is none of operator", () => {
		it("returns true when value is not in list", () => {
			expect(optionFilterFn("inactive", optionFilter("is none of", ["active", "pending"]))).toBe(
				true,
			);
		});

		it("returns false when value is in list", () => {
			expect(optionFilterFn("active", optionFilter("is none of", ["active", "pending"]))).toBe(
				false,
			);
		});
	});
});

describe("multiOptionFilterFn", () => {
	it("returns false for empty input data", () => {
		expect(multiOptionFilterFn(null, multiOptionFilter("include", ["tag1"]))).toBe(false);
	});

	it("returns true when filter values are empty", () => {
		expect(multiOptionFilterFn(["tag1", "tag2"], multiOptionFilter("include", []))).toBe(true);
	});

	describe("include operator", () => {
		it("returns true when any value matches", () => {
			expect(multiOptionFilterFn(["tag1", "tag2"], multiOptionFilter("include", ["tag1"]))).toBe(
				true,
			);
		});

		it("returns false when no values match", () => {
			expect(multiOptionFilterFn(["tag1", "tag2"], multiOptionFilter("include", ["tag3"]))).toBe(
				false,
			);
		});
	});

	describe("exclude operator", () => {
		it("returns true when no values match", () => {
			expect(multiOptionFilterFn(["tag1", "tag2"], multiOptionFilter("exclude", ["tag3"]))).toBe(
				true,
			);
		});

		it("returns false when any value matches", () => {
			expect(multiOptionFilterFn(["tag1", "tag2"], multiOptionFilter("exclude", ["tag1"]))).toBe(
				false,
			);
		});
	});

	describe("include any of operator", () => {
		it("returns true when any filter value is in data", () => {
			expect(
				multiOptionFilterFn(
					["tag1", "tag2"],
					multiOptionFilter("include any of", ["tag1", "tag3"]),
				),
			).toBe(true);
		});

		it("returns false when no filter values are in data", () => {
			expect(
				multiOptionFilterFn(
					["tag1", "tag2"],
					multiOptionFilter("include any of", ["tag3", "tag4"]),
				),
			).toBe(false);
		});
	});

	describe("include all of operator", () => {
		it("returns true when all filter values are in data", () => {
			expect(
				multiOptionFilterFn(
					["tag1", "tag2", "tag3"],
					multiOptionFilter("include all of", ["tag1", "tag2"]),
				),
			).toBe(true);
		});

		it("returns false when not all filter values are in data", () => {
			expect(
				multiOptionFilterFn(
					["tag1", "tag2"],
					multiOptionFilter("include all of", ["tag1", "tag4"]),
				),
			).toBe(false);
		});
	});

	describe("exclude if any of operator", () => {
		it("returns false when any filter value is in data", () => {
			expect(
				multiOptionFilterFn(
					["tag1", "tag2"],
					multiOptionFilter("exclude if any of", ["tag1", "tag3"]),
				),
			).toBe(false);
		});

		it("returns true when no filter values are in data", () => {
			expect(
				multiOptionFilterFn(
					["tag1", "tag2"],
					multiOptionFilter("exclude if any of", ["tag3", "tag4"]),
				),
			).toBe(true);
		});
	});

	describe("exclude if all operator", () => {
		it("returns false when all filter values are in data", () => {
			expect(
				multiOptionFilterFn(
					["tag1", "tag2", "tag3"],
					multiOptionFilter("exclude if all", ["tag1", "tag2"]),
				),
			).toBe(false);
		});

		it("returns true when not all filter values are in data", () => {
			expect(
				multiOptionFilterFn(
					["tag1", "tag2"],
					multiOptionFilter("exclude if all", ["tag1", "tag4"]),
				),
			).toBe(true);
		});
	});
});

describe("textFilterFn", () => {
	it("returns true when filter is undefined", () => {
		expect(textFilterFn("hello", undefined)).toBe(true);
	});

	it("returns true when filter values are empty", () => {
		expect(textFilterFn("hello", textFilter("contains", []))).toBe(true);
	});

	it("returns true when filter value is empty string", () => {
		expect(textFilterFn("hello", textFilter("contains", [""]))).toBe(true);
	});

	describe("contains operator", () => {
		it("returns true when text contains filter value", () => {
			expect(textFilterFn("hello", textFilter("contains", ["ell"]))).toBe(true);
		});

		it("returns false when text does not contain filter value", () => {
			expect(textFilterFn("hello", textFilter("contains", ["xyz"]))).toBe(false);
		});

		it("is case-insensitive", () => {
			expect(textFilterFn("hello world", textFilter("contains", ["HELLO"]))).toBe(true);
		});

		it("trims whitespace from both input and filter", () => {
			expect(textFilterFn("  hello world  ", textFilter("contains", ["  hello  "]))).toBe(true);
		});
	});

	describe("does not contain operator", () => {
		it("returns true when text does not contain filter value", () => {
			expect(textFilterFn("hello", textFilter("does not contain", ["xyz"]))).toBe(true);
		});

		it("returns false when text contains filter value", () => {
			expect(textFilterFn("hello", textFilter("does not contain", ["ell"]))).toBe(false);
		});
	});
});

describe("numberFilterFn", () => {
	it("returns true when filter is undefined", () => {
		expect(numberFilterFn(5, undefined)).toBe(true);
	});

	it("returns true when filter values are empty", () => {
		expect(numberFilterFn(5, numberFilter("is", []))).toBe(true);
	});

	describe("is operator", () => {
		it("returns true when values are equal", () => {
			expect(numberFilterFn(5, numberFilter("is", [5]))).toBe(true);
		});

		it("returns false when values are not equal", () => {
			expect(numberFilterFn(6, numberFilter("is", [5]))).toBe(false);
		});
	});

	describe("is not operator", () => {
		it("returns true when values are not equal", () => {
			expect(numberFilterFn(6, numberFilter("is not", [5]))).toBe(true);
		});

		it("returns false when values are equal", () => {
			expect(numberFilterFn(5, numberFilter("is not", [5]))).toBe(false);
		});
	});

	describe("is greater than operator", () => {
		it("returns true when input is greater", () => {
			expect(numberFilterFn(6, numberFilter("is greater than", [5]))).toBe(true);
		});

		it("returns false when input is equal", () => {
			expect(numberFilterFn(5, numberFilter("is greater than", [5]))).toBe(false);
		});

		it("returns false when input is less", () => {
			expect(numberFilterFn(4, numberFilter("is greater than", [5]))).toBe(false);
		});
	});

	describe("is greater than or equal to operator", () => {
		it("returns true when input is greater", () => {
			expect(numberFilterFn(6, numberFilter("is greater than or equal to", [5]))).toBe(true);
		});

		it("returns true when input is equal", () => {
			expect(numberFilterFn(5, numberFilter("is greater than or equal to", [5]))).toBe(true);
		});

		it("returns false when input is less", () => {
			expect(numberFilterFn(4, numberFilter("is greater than or equal to", [5]))).toBe(false);
		});
	});

	describe("is less than operator", () => {
		it("returns true when input is less", () => {
			expect(numberFilterFn(4, numberFilter("is less than", [5]))).toBe(true);
		});

		it("returns false when input is equal", () => {
			expect(numberFilterFn(5, numberFilter("is less than", [5]))).toBe(false);
		});

		it("returns false when input is greater", () => {
			expect(numberFilterFn(6, numberFilter("is less than", [5]))).toBe(false);
		});
	});

	describe("is less than or equal to operator", () => {
		it("returns true when input is less", () => {
			expect(numberFilterFn(4, numberFilter("is less than or equal to", [5]))).toBe(true);
		});

		it("returns true when input is equal", () => {
			expect(numberFilterFn(5, numberFilter("is less than or equal to", [5]))).toBe(true);
		});

		it("returns false when input is greater", () => {
			expect(numberFilterFn(6, numberFilter("is less than or equal to", [5]))).toBe(false);
		});
	});

	describe("is between operator", () => {
		it("returns true when input is within range", () => {
			expect(numberFilterFn(7, numberFilter("is between", [5, 10]))).toBe(true);
		});

		it("returns true when input equals lower bound", () => {
			expect(numberFilterFn(5, numberFilter("is between", [5, 10]))).toBe(true);
		});

		it("returns true when input equals upper bound", () => {
			expect(numberFilterFn(10, numberFilter("is between", [5, 10]))).toBe(true);
		});

		it("returns false when input is below range", () => {
			expect(numberFilterFn(4, numberFilter("is between", [5, 10]))).toBe(false);
		});

		it("returns false when input is above range", () => {
			expect(numberFilterFn(11, numberFilter("is between", [5, 10]))).toBe(false);
		});
	});

	describe("is not between operator", () => {
		it("returns false when input is within range", () => {
			expect(numberFilterFn(7, numberFilter("is not between", [5, 10]))).toBe(false);
		});

		it("returns true when input is below range", () => {
			expect(numberFilterFn(4, numberFilter("is not between", [5, 10]))).toBe(true);
		});

		it("returns true when input is above range", () => {
			expect(numberFilterFn(11, numberFilter("is not between", [5, 10]))).toBe(true);
		});
	});
});

describe("dateFilterFn", () => {
	const today = new Date("2024-06-15T12:00:00");
	const yesterday = new Date("2024-06-14T12:00:00");
	const tomorrow = new Date("2024-06-16T12:00:00");
	const lastWeek = new Date("2024-06-08T12:00:00");
	const nextWeek = new Date("2024-06-22T12:00:00");

	it("returns true when filter is undefined", () => {
		expect(dateFilterFn(today, undefined)).toBe(true);
	});

	it("returns true when filter values are empty", () => {
		expect(dateFilterFn(today, dateFilter("is", []))).toBe(true);
	});

	describe("is operator", () => {
		it("returns true when dates are same day", () => {
			expect(dateFilterFn(today, dateFilter("is", [new Date("2024-06-15T00:00:00")]))).toBe(true);
		});

		it("returns false when dates are different days", () => {
			expect(dateFilterFn(today, dateFilter("is", [yesterday]))).toBe(false);
		});
	});

	describe("is not operator", () => {
		it("returns true when dates are different days", () => {
			expect(dateFilterFn(today, dateFilter("is not", [yesterday]))).toBe(true);
		});

		it("returns false when dates are same day", () => {
			expect(dateFilterFn(today, dateFilter("is not", [new Date("2024-06-15T00:00:00")]))).toBe(
				false,
			);
		});
	});

	describe("is before operator", () => {
		it("returns true when date is before filter date", () => {
			expect(dateFilterFn(today, dateFilter("is before", [tomorrow]))).toBe(true);
		});

		it("returns false when date is same day", () => {
			expect(dateFilterFn(today, dateFilter("is before", [today]))).toBe(false);
		});

		it("returns false when date is after filter date", () => {
			expect(dateFilterFn(today, dateFilter("is before", [yesterday]))).toBe(false);
		});
	});

	describe("is after operator", () => {
		it("returns true when date is after filter date", () => {
			expect(dateFilterFn(today, dateFilter("is after", [yesterday]))).toBe(true);
		});

		it("returns false when date is same day", () => {
			expect(dateFilterFn(today, dateFilter("is after", [today]))).toBe(false);
		});

		it("returns false when date is before filter date", () => {
			expect(dateFilterFn(today, dateFilter("is after", [tomorrow]))).toBe(false);
		});
	});

	describe("is on or after operator", () => {
		it("returns true when date is after filter date", () => {
			expect(dateFilterFn(today, dateFilter("is on or after", [yesterday]))).toBe(true);
		});

		it("returns true when date is same day", () => {
			expect(
				dateFilterFn(today, dateFilter("is on or after", [new Date("2024-06-15T00:00:00")])),
			).toBe(true);
		});

		it("returns false when date is before filter date", () => {
			expect(dateFilterFn(today, dateFilter("is on or after", [tomorrow]))).toBe(false);
		});
	});

	describe("is on or before operator", () => {
		it("returns true when date is before filter date", () => {
			expect(dateFilterFn(today, dateFilter("is on or before", [tomorrow]))).toBe(true);
		});

		it("returns true when date is same day", () => {
			expect(
				dateFilterFn(today, dateFilter("is on or before", [new Date("2024-06-15T00:00:00")])),
			).toBe(true);
		});

		it("returns false when date is after filter date", () => {
			expect(dateFilterFn(today, dateFilter("is on or before", [yesterday]))).toBe(false);
		});
	});

	describe("is between operator", () => {
		it("returns true when date is within range", () => {
			expect(dateFilterFn(today, dateFilter("is between", [lastWeek, nextWeek]))).toBe(true);
		});

		it("returns true when date is on start boundary", () => {
			expect(
				dateFilterFn(today, dateFilter("is between", [new Date("2024-06-15T00:00:00"), nextWeek])),
			).toBe(true);
		});

		it("returns true when date is on end boundary", () => {
			expect(
				dateFilterFn(today, dateFilter("is between", [lastWeek, new Date("2024-06-15T23:59:59")])),
			).toBe(true);
		});

		it("returns false when date is before range", () => {
			expect(dateFilterFn(today, dateFilter("is between", [tomorrow, nextWeek]))).toBe(false);
		});

		it("returns false when date is after range", () => {
			expect(dateFilterFn(today, dateFilter("is between", [lastWeek, yesterday]))).toBe(false);
		});

		it("returns true when only one date provided", () => {
			expect(dateFilterFn(today, dateFilter("is between", [lastWeek]))).toBe(true);
		});
	});

	describe("is not between operator", () => {
		it("returns false when date is within range", () => {
			expect(dateFilterFn(today, dateFilter("is not between", [lastWeek, nextWeek]))).toBe(false);
		});

		it("returns true when date is before range", () => {
			expect(dateFilterFn(today, dateFilter("is not between", [tomorrow, nextWeek]))).toBe(true);
		});

		it("returns true when date is after range", () => {
			expect(dateFilterFn(today, dateFilter("is not between", [lastWeek, yesterday]))).toBe(true);
		});
	});

	describe("date normalization", () => {
		it("handles string dates", () => {
			expect(dateFilterFn(today, dateFilter("is", ["2024-06-15"]))).toBe(true);
		});

		it("handles timestamp numbers", () => {
			expect(dateFilterFn(today, dateFilter("is", [new Date("2024-06-15").getTime()]))).toBe(true);
		});

		it("handles invalid date values gracefully", () => {
			expect(dateFilterFn(today, dateFilter("is", ["invalid-date"]))).toBe(true);
		});
	});
});
