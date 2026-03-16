import { describe, expect, it } from "vite-plus/test";

import { determineNewOperator } from "@roasted/web/components/data-table-filter/operators";

describe("determineNewOperator", () => {
	describe("no transition needed", () => {
		it("returns current operator when value counts are equal", () => {
			expect(determineNewOperator("option", ["a"], ["b"], "is")).toBe("is");
			expect(determineNewOperator("option", ["a", "b"], ["c", "d"], "is any of")).toBe("is any of");
		});

		it("returns current operator when both counts are >= 2", () => {
			expect(determineNewOperator("option", ["a", "b"], ["c", "d", "e"], "is any of")).toBe(
				"is any of",
			);
			expect(determineNewOperator("option", ["a", "b", "c"], ["d", "e"], "is any of")).toBe(
				"is any of",
			);
		});

		it("returns current operator when both counts are <= 1", () => {
			expect(determineNewOperator("option", [], ["a"], "is")).toBe("is");
			expect(determineNewOperator("option", ["a"], [], "is")).toBe("is");
		});
	});

	describe("option type transitions", () => {
		it("transitions from singular to plural when going from 1 to 2+ values", () => {
			expect(determineNewOperator("option", ["a"], ["a", "b"], "is")).toBe("is any of");
			expect(determineNewOperator("option", ["a"], ["a", "b"], "is not")).toBe("is none of");
		});

		it("transitions from plural to singular when going from 2+ to 1 value", () => {
			expect(determineNewOperator("option", ["a", "b"], ["a"], "is any of")).toBe("is");
			expect(determineNewOperator("option", ["a", "b"], ["a"], "is none of")).toBe("is not");
		});

		it("returns current operator when no singular/plural form exists", () => {
			expect(determineNewOperator("option", ["a"], ["a", "b"], "is any of")).toBe("is any of");
		});
	});

	describe("multiOption type transitions", () => {
		it("transitions from singular to plural when going from 1 to 2+ values", () => {
			expect(determineNewOperator("multiOption", ["a"], ["a", "b"], "include")).toBe(
				"include any of",
			);
			expect(determineNewOperator("multiOption", ["a"], ["a", "b"], "exclude")).toBe(
				"exclude if any of",
			);
		});

		it("transitions from plural to singular when going from 2+ to 1 value", () => {
			expect(determineNewOperator("multiOption", ["a", "b"], ["a"], "include any of")).toBe(
				"include",
			);
			expect(determineNewOperator("multiOption", ["a", "b"], ["a"], "include all of")).toBe(
				"include",
			);
			expect(determineNewOperator("multiOption", ["a", "b"], ["a"], "exclude if all")).toBe(
				"exclude",
			);
			expect(determineNewOperator("multiOption", ["a", "b"], ["a"], "exclude if any of")).toBe(
				"exclude",
			);
		});
	});

	describe("number type transitions", () => {
		it("transitions from singular to plural (is between)", () => {
			expect(determineNewOperator("number", [5], [5, 10], "is")).toBe("is between");
			expect(determineNewOperator("number", [5], [5, 10], "is not")).toBe("is not between");
		});

		it("transitions from plural to singular", () => {
			expect(determineNewOperator("number", [5, 10], [5], "is between")).toBe("is");
			expect(determineNewOperator("number", [5, 10], [5], "is not between")).toBe("is not");
		});

		it("keeps comparison operators unchanged when transitioning", () => {
			expect(determineNewOperator("number", [5], [5, 10], "is greater than")).toBe("is between");
			expect(determineNewOperator("number", [5], [5, 10], "is less than")).toBe("is between");
		});
	});

	describe("date type transitions", () => {
		const date1 = new Date("2024-01-01");
		const date2 = new Date("2024-12-31");

		it("transitions from singular to plural (is between)", () => {
			expect(determineNewOperator("date", [date1], [date1, date2], "is")).toBe("is between");
			expect(determineNewOperator("date", [date1], [date1, date2], "is not")).toBe(
				"is not between",
			);
		});

		it("transitions from plural to singular", () => {
			expect(determineNewOperator("date", [date1, date2], [date1], "is between")).toBe("is");
			expect(determineNewOperator("date", [date1, date2], [date1], "is not between")).toBe(
				"is not",
			);
		});
	});

	describe("text type", () => {
		it("returns current operator (text has no plural/singular transitions)", () => {
			expect(determineNewOperator("text", ["a"], ["a", "b"], "contains")).toBe("contains");
			expect(determineNewOperator("text", ["a", "b"], ["a"], "does not contain")).toBe(
				"does not contain",
			);
		});
	});

	describe("edge cases", () => {
		it("handles empty arrays", () => {
			expect(determineNewOperator("option", [], ["a", "b"], "is")).toBe("is any of");
			expect(determineNewOperator("option", ["a", "b"], [], "is any of")).toBe("is");
		});

		it("handles transition from 0 to 1 (no change needed)", () => {
			expect(determineNewOperator("option", [], ["a"], "is")).toBe("is");
		});
	});
});
