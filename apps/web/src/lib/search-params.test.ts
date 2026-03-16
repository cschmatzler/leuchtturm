import { describe, expect, it } from "vite-plus/test";

import type { FiltersState } from "@one/web/components/data-table-filter/types";
import {
	parseFilters,
	parseSearch,
	stringifyFilters,
	stringifySearch,
} from "@one/web/lib/search-params";

describe("stringifyFilters", () => {
	it("encodes text filter with contains operator", () => {
		const filters: FiltersState = [
			{ columnId: "lastName", type: "text", operator: "contains", values: ["r"] },
		];

		const result = stringifyFilters(filters, "filters");

		expect(result).toEqual({ "filters.lastName.t.c": "r" });
	});

	it("encodes text filter with does not contain operator", () => {
		const filters: FiltersState = [
			{ columnId: "name", type: "text", operator: "does not contain", values: ["test"] },
		];

		const result = stringifyFilters(filters, "filters");

		expect(result).toEqual({ "filters.name.t.nc": "test" });
	});

	it("encodes number filter with comparison operators", () => {
		const filters: FiltersState = [
			{ columnId: "age", type: "number", operator: "is greater than", values: [18] },
		];

		const result = stringifyFilters(filters, "filters");

		expect(result).toEqual({ "filters.age.n.gt": "18" });
	});

	it("encodes number filter with between operator", () => {
		const filters: FiltersState = [
			{ columnId: "price", type: "number", operator: "is between", values: [10, 100] },
		];

		const result = stringifyFilters(filters, "filters");

		expect(result).toEqual({ "filters.price.n.between": "10,100" });
	});

	it("encodes date filter", () => {
		const filters: FiltersState = [
			{
				columnId: "createdAt",
				type: "date",
				operator: "is after",
				values: [new Date("2024-01-15")],
			},
		];

		const result = stringifyFilters(filters, "filters");

		expect(result).toEqual({ "filters.createdAt.d.after": "2024-01-15" });
	});

	it("encodes option filter with is any of operator", () => {
		const filters: FiltersState = [
			{ columnId: "status", type: "option", operator: "is any of", values: ["active", "pending"] },
		];

		const result = stringifyFilters(filters, "filters");

		expect(result).toEqual({ "filters.status.o.anyOf": "active,pending" });
	});

	it("encodes multiOption filter", () => {
		const filters: FiltersState = [
			{
				columnId: "tags",
				type: "multiOption",
				operator: "include any of",
				values: ["a", "b", "c"],
			},
		];

		const result = stringifyFilters(filters, "filters");

		expect(result).toEqual({ "filters.tags.mo.incAny": "a,b,c" });
	});

	it("encodes multiple filters", () => {
		const filters: FiltersState = [
			{ columnId: "lastName", type: "text", operator: "contains", values: ["r"] },
			{ columnId: "firstName", type: "text", operator: "contains", values: ["foo"] },
		];

		const result = stringifyFilters(filters, "filters");

		expect(result).toEqual({
			"filters.lastName.t.c": "r",
			"filters.firstName.t.c": "foo",
		});
	});

	it("uses custom key prefix", () => {
		const filters: FiltersState = [
			{ columnId: "name", type: "text", operator: "contains", values: ["John"] },
		];

		const result = stringifyFilters(filters, "mfilters");

		expect(result).toEqual({ "mfilters.name.t.c": "John" });
	});

	it("escapes commas in values", () => {
		const filters: FiltersState = [
			{ columnId: "name", type: "text", operator: "contains", values: ["a,b"] },
		];

		const result = stringifyFilters(filters, "filters");

		expect(result).toEqual({ "filters.name.t.c": "a\\,b" });
	});

	it("escapes dots in values", () => {
		const filters: FiltersState = [
			{ columnId: "email", type: "text", operator: "contains", values: ["test.com"] },
		];

		const result = stringifyFilters(filters, "filters");

		expect(result).toEqual({ "filters.email.t.c": "test\\.com" });
	});
});

describe("parseFilters", () => {
	it("parses text filter with contains operator", () => {
		const params = { "filters.lastName.t.c": "r" };

		const result = parseFilters(params, "filters");

		expect(result).toEqual([
			{ columnId: "lastName", type: "text", operator: "contains", values: ["r"] },
		]);
	});

	it("parses text filter with does not contain operator", () => {
		const params = { "filters.name.t.nc": "test" };

		const result = parseFilters(params, "filters");

		expect(result).toEqual([
			{ columnId: "name", type: "text", operator: "does not contain", values: ["test"] },
		]);
	});

	it("parses number filter", () => {
		const params = { "filters.age.n.gt": "18" };

		const result = parseFilters(params, "filters");

		expect(result).toEqual([
			{ columnId: "age", type: "number", operator: "is greater than", values: [18] },
		]);
	});

	it("parses number filter with multiple values", () => {
		const params = { "filters.price.n.between": "10,100" };

		const result = parseFilters(params, "filters");

		expect(result).toEqual([
			{ columnId: "price", type: "number", operator: "is between", values: [10, 100] },
		]);
	});

	it("parses date filter", () => {
		const params = { "filters.createdAt.d.after": "2024-01-15" };

		const result = parseFilters(params, "filters");

		expect(result).toHaveLength(1);
		expect(result[0].columnId).toBe("createdAt");
		expect(result[0].type).toBe("date");
		expect(result[0].operator).toBe("is after");
		expect(result[0].values[0]).toBeInstanceOf(Date);
	});

	it("parses option filter with multiple values", () => {
		const params = { "filters.status.o.anyOf": "active,pending" };

		const result = parseFilters(params, "filters");

		expect(result).toEqual([
			{ columnId: "status", type: "option", operator: "is any of", values: ["active", "pending"] },
		]);
	});

	it("parses multiOption filter", () => {
		const params = { "filters.tags.mo.incAny": "a,b,c" };

		const result = parseFilters(params, "filters");

		expect(result).toEqual([
			{
				columnId: "tags",
				type: "multiOption",
				operator: "include any of",
				values: ["a", "b", "c"],
			},
		]);
	});

	it("parses multiple filters", () => {
		const params = {
			"filters.lastName.t.c": "r",
			"filters.firstName.t.c": "foo",
		};

		const result = parseFilters(params, "filters");

		expect(result).toEqual([
			{ columnId: "lastName", type: "text", operator: "contains", values: ["r"] },
			{ columnId: "firstName", type: "text", operator: "contains", values: ["foo"] },
		]);
	});

	it("uses custom key prefix", () => {
		const params = { "mfilters.name.t.c": "John" };

		const result = parseFilters(params, "mfilters");

		expect(result).toEqual([
			{ columnId: "name", type: "text", operator: "contains", values: ["John"] },
		]);
	});

	it("ignores params with different prefix", () => {
		const params = {
			"filters.name.t.c": "John",
			"mfilters.email.t.c": "test",
			page: "1",
		};

		const result = parseFilters(params, "filters");

		expect(result).toEqual([
			{ columnId: "name", type: "text", operator: "contains", values: ["John"] },
		]);
	});

	it("unescapes commas in values", () => {
		const params = { "filters.name.t.c": "a\\,b" };

		const result = parseFilters(params, "filters");

		expect(result).toEqual([
			{ columnId: "name", type: "text", operator: "contains", values: ["a,b"] },
		]);
	});

	it("unescapes dots in values", () => {
		const params = { "filters.email.t.c": "test\\.com" };

		const result = parseFilters(params, "filters");

		expect(result).toEqual([
			{ columnId: "email", type: "text", operator: "contains", values: ["test.com"] },
		]);
	});
});

describe("roundtrip", () => {
	it("preserves text filters through stringify and parse", () => {
		const original: FiltersState = [
			{ columnId: "lastName", type: "text", operator: "contains", values: ["r"] },
			{ columnId: "firstName", type: "text", operator: "does not contain", values: ["test"] },
		];

		const stringified = stringifyFilters(original, "filters");
		const parsed = parseFilters(stringified, "filters");

		expect(parsed).toEqual(original);
	});

	it("preserves number filters through stringify and parse", () => {
		const original: FiltersState = [
			{ columnId: "age", type: "number", operator: "is between", values: [18, 65] },
		];

		const stringified = stringifyFilters(original, "filters");
		const parsed = parseFilters(stringified, "filters");

		expect(parsed).toEqual(original);
	});

	it("preserves option filters through stringify and parse", () => {
		const original: FiltersState = [
			{
				columnId: "status",
				type: "option",
				operator: "is any of",
				values: ["active", "pending", "completed"],
			},
		];

		const stringified = stringifyFilters(original, "filters");
		const parsed = parseFilters(stringified, "filters");

		expect(parsed).toEqual(original);
	});

	it("preserves escaped values through stringify and parse", () => {
		const original: FiltersState = [
			{ columnId: "email", type: "text", operator: "contains", values: ["user@test.com,other"] },
		];

		const stringified = stringifyFilters(original, "filters");
		const parsed = parseFilters(stringified, "filters");

		expect(parsed).toEqual(original);
	});
});

describe("router search roundtrip", () => {
	it("roundtrips scalars and filters", () => {
		const search = {
			page: 2,
			showInactive: false,
			filters: [
				{ columnId: "lastName", type: "text", operator: "contains", values: ["r"] },
				{ columnId: "email", type: "text", operator: "contains", values: ["a,b.test"] },
			],
		};

		const str = stringifySearch(search);
		const parsed = parseSearch(str);

		expect(parsed).toEqual(search);
	});
});
