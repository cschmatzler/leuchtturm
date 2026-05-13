import { describe, expect, it } from "vitest";

import {
	isColumnOption,
	isColumnOptionArray,
	isColumnOptionMap,
	isMinMaxTuple,
	isStringArray,
} from "@leuchtturm/web/components/data-table-filter/guards";

describe("isColumnOption", () => {
	it("accepts objects with value and label", () => {
		expect(isColumnOption({ value: "active", label: "Active" })).toBe(true);
	});

	it("rejects missing or non-object values", () => {
		expect(isColumnOption({ value: "active" })).toBe(false);
		expect(isColumnOption(null)).toBe(false);
		expect(isColumnOption("active")).toBe(false);
	});
});

describe("isColumnOptionArray", () => {
	it("accepts arrays of column options", () => {
		expect(isColumnOptionArray([{ value: "active", label: "Active" }])).toBe(true);
	});

	it("rejects arrays containing non-options", () => {
		expect(isColumnOptionArray([{ value: "active" }])).toBe(false);
		expect(isColumnOptionArray("active")).toBe(false);
	});
});

describe("isStringArray", () => {
	it("accepts string arrays", () => {
		expect(isStringArray(["active", "pending"])).toBe(true);
	});

	it("rejects non-string arrays", () => {
		expect(isStringArray(["active", 1])).toBe(false);
		expect(isStringArray("active")).toBe(false);
	});
});

describe("isColumnOptionMap", () => {
	it("accepts maps with string keys and number values", () => {
		expect(isColumnOptionMap(new Map([["active", 2]]))).toBe(true);
	});

	it("rejects maps with non-string keys", () => {
		expect(isColumnOptionMap(new Map([[1, 2]]))).toBe(false);
	});

	it("rejects maps with non-number values", () => {
		expect(isColumnOptionMap(new Map([["active", "2"]]))).toBe(false);
	});

	it("rejects non-maps", () => {
		expect(isColumnOptionMap({ active: 2 })).toBe(false);
	});
});

describe("isMinMaxTuple", () => {
	it("accepts two-number tuples", () => {
		expect(isMinMaxTuple([1, 2])).toBe(true);
	});

	it("rejects invalid tuples", () => {
		expect(isMinMaxTuple([1])).toBe(false);
		expect(isMinMaxTuple([1, "2"])).toBe(false);
		expect(isMinMaxTuple("1,2")).toBe(false);
	});
});
