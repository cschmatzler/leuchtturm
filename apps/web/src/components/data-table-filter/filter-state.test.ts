import { Circle } from "@phosphor-icons/react/Circle";
import { describe, expect, it } from "vitest";

import { updateFilters } from "@leuchtturm/web/components/data-table-filter/filter-state";
import type {
	ColumnConfig,
	FiltersState,
} from "@leuchtturm/web/components/data-table-filter/types";

type TestItem = {
	status: string;
	score: number;
	createdAt: Date;
};

const testIcon = Circle;

const statusColumn: ColumnConfig<TestItem, "option", string> = {
	id: "status",
	type: "option",
	accessor: (row) => row.status,
	displayName: "Status",
	icon: testIcon,
};

const scoreColumn: ColumnConfig<TestItem, "number", number> = {
	id: "score",
	type: "number",
	accessor: (row) => row.score,
	displayName: "Score",
	icon: testIcon,
};

const createdAtColumn: ColumnConfig<TestItem, "date", Date> = {
	id: "createdAt",
	type: "date",
	accessor: (row) => row.createdAt,
	displayName: "Created",
	icon: testIcon,
};

describe("updateFilters", () => {
	it("adds and removes option values while updating operators", () => {
		let filters: FiltersState = [];

		filters = updateFilters(filters, {
			type: "addFilterValue",
			column: statusColumn,
			values: ["active"],
		});

		expect(filters).toEqual([
			{
				columnId: "status",
				type: "option",
				operator: "is",
				values: ["active"],
			},
		]);

		filters = updateFilters(filters, {
			type: "addFilterValue",
			column: statusColumn,
			values: ["inactive"],
		});

		expect(filters[0]).toMatchObject({
			operator: "is any of",
			values: ["active", "inactive"],
		});

		filters = updateFilters(filters, {
			type: "removeFilterValue",
			column: statusColumn,
			values: ["active"],
		});

		expect(filters[0]).toMatchObject({
			operator: "is",
			values: ["inactive"],
		});

		filters = updateFilters(filters, {
			type: "removeFilterValue",
			column: statusColumn,
			values: ["inactive"],
		});

		expect(filters).toEqual([]);
	});

	it("leaves filters unchanged when removing an option from an unfiltered column", () => {
		const filters: FiltersState = [
			{
				columnId: "other",
				type: "text",
				operator: "contains",
				values: ["abc"],
			},
		];

		expect(
			updateFilters(filters, {
				type: "removeFilterValue",
				column: statusColumn,
				values: ["active"],
			}),
		).toEqual(filters);
	});

	it("normalizes number ranges when setting values", () => {
		const filters = updateFilters([], {
			type: "setFilterValue",
			column: scoreColumn,
			values: [20, 10],
		});

		expect(filters).toEqual([
			{
				columnId: "score",
				type: "number",
				operator: "is between",
				values: [10, 20],
			},
		]);
	});

	it("keeps existing filters when setting an empty value", () => {
		const filters: FiltersState = [
			{
				columnId: "score",
				type: "number",
				operator: "is",
				values: [10],
			},
		];

		expect(
			updateFilters(filters, {
				type: "setFilterValue",
				column: scoreColumn,
				values: [],
			}),
		).toBe(filters);
	});

	it("trims date ranges when switching to single-value operators", () => {
		const start = new Date("2024-01-01");
		const end = new Date("2024-02-01");
		const filters: FiltersState = [
			{
				columnId: "createdAt",
				type: "date",
				operator: "is between",
				values: [start, end],
			},
		];

		expect(
			updateFilters(filters, {
				type: "setFilterOperator",
				columnId: createdAtColumn.id,
				operator: "is",
			}),
		).toEqual([
			{
				columnId: "createdAt",
				type: "date",
				operator: "is",
				values: [start],
			},
		]);
	});

	it("removes one filter or all filters", () => {
		const filters: FiltersState = [
			{
				columnId: "status",
				type: "option",
				operator: "is",
				values: ["active"],
			},
			{
				columnId: "score",
				type: "number",
				operator: "is",
				values: [10],
			},
		];

		const remaining = updateFilters(filters, { type: "removeFilter", columnId: "status" });

		expect(remaining).toEqual([filters[1]]);
		expect(updateFilters(remaining, { type: "removeAllFilters" })).toEqual([]);
	});

	it("throws when option-only actions receive non-option columns", () => {
		expect(() =>
			updateFilters([], {
				type: "addFilterValue",
				column: scoreColumn,
				values: ["active"],
			}),
		).toThrow("[data-table-filter] addFilterValue() is only supported for option columns");
	});
});
