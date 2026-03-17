import { act, renderHook } from "@testing-library/react";
import { Circle } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { describe, expect, it } from "vite-plus/test";

import { createFilterBuilder } from "@chevrotain/web/components/data-table-filter/filters";
import type {
	ColumnOption,
	FiltersState,
} from "@chevrotain/web/components/data-table-filter/types";
import { useDataTableFilters } from "@chevrotain/web/hooks/use-data-table-filters";

type TestRow = {
	id: string;
	status: string;
	tags: string[];
	score: number;
	createdAt: Date;
};

const testIcon = Circle;
const builder = createFilterBuilder<TestRow>();

const statusOptions: ColumnOption[] = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
];

const tagOptions: ColumnOption[] = [
	{ value: "espresso", label: "Espresso" },
	{ value: "filter", label: "Filter" },
];

const filterDefinitions = [
	builder
		.option()
		.id("status")
		.accessor((row) => row.status)
		.displayName("Status")
		.icon(testIcon)
		.options(statusOptions)
		.build(),
	builder
		.multiOption()
		.id("tags")
		.accessor((row) => row.tags)
		.displayName("Tags")
		.icon(testIcon)
		.options(tagOptions)
		.build(),
	builder
		.number()
		.id("score")
		.accessor((row) => row.score)
		.displayName("Score")
		.icon(testIcon)
		.build(),
	builder
		.date()
		.id("createdAt")
		.accessor((row) => row.createdAt)
		.displayName("Created")
		.icon(testIcon)
		.build(),
] as const;

const data: TestRow[] = [
	{
		id: "1",
		status: "active",
		tags: ["espresso"],
		score: 12,
		createdAt: new Date("2024-01-01"),
	},
	{
		id: "2",
		status: "inactive",
		tags: ["filter"],
		score: 22,
		createdAt: new Date("2024-02-01"),
	},
];

describe("useDataTableFilters", () => {
	it("requires controlled state to provide both inputs", () => {
		expect(() =>
			renderHook(() =>
				useDataTableFilters({
					strategy: "client",
					data,
					filterDefinitions,
					filters: [],
				}),
			),
		).toThrow("If using controlled state, you must specify both filters and onFiltersChange.");

		const onFiltersChange: Dispatch<SetStateAction<FiltersState>> = () => {};
		expect(() =>
			renderHook(() =>
				useDataTableFilters({
					strategy: "client",
					data,
					filterDefinitions,
					onFiltersChange,
				}),
			),
		).toThrow("If using controlled state, you must specify both filters and onFiltersChange.");
	});

	it("merges provided options and faceted metadata", () => {
		const overrideOptions: ColumnOption[] = [{ value: "pending", label: "Pending" }];
		const facetedOptions = new Map([["pending", 3]]);
		const facetedRange: [number, number] = [4, 18];

		const { result } = renderHook(() =>
			useDataTableFilters({
				strategy: "server",
				data,
				filterDefinitions,
				options: { status: overrideOptions },
				faceted: { status: facetedOptions, score: facetedRange },
			}),
		);

		const statusColumn = result.current.filterColumns.find((column) => column.id === "status");
		const scoreColumn = result.current.filterColumns.find((column) => column.id === "score");

		expect(statusColumn?.options).toEqual(overrideOptions);
		expect(statusColumn?.facetedOptions).toBe(facetedOptions);
		expect(scoreColumn?.min).toBe(4);
		expect(scoreColumn?.max).toBe(18);
	});

	it("adds and removes option filters while updating operators", () => {
		const { result } = renderHook(() =>
			useDataTableFilters({
				strategy: "client",
				data,
				filterDefinitions,
			}),
		);

		const statusColumn = result.current.filterColumns.find((column) => column.id === "status");
		const tagsColumn = result.current.filterColumns.find((column) => column.id === "tags");
		if (!statusColumn || !tagsColumn) {
			throw new Error("Expected status and tags columns to exist");
		}

		act(() => {
			result.current.actions.addFilterValue(statusColumn, ["active"]);
		});

		let statusFilter = result.current.filters.find((filter) => filter.columnId === "status");
		expect(statusFilter?.operator).toBe("is");
		expect(statusFilter?.values).toEqual(["active"]);

		act(() => {
			result.current.actions.addFilterValue(statusColumn, ["inactive"]);
		});

		statusFilter = result.current.filters.find((filter) => filter.columnId === "status");
		expect(statusFilter?.operator).toBe("is any of");
		expect(statusFilter?.values).toEqual(["active", "inactive"]);

		act(() => {
			result.current.actions.addFilterValue(tagsColumn, ["espresso"]);
		});
		let tagsFilter = result.current.filters.find((filter) => filter.columnId === "tags");
		expect(tagsFilter?.operator).toBe("include");

		act(() => {
			result.current.actions.removeFilterValue(tagsColumn, ["espresso"]);
		});
		tagsFilter = result.current.filters.find((filter) => filter.columnId === "tags");
		expect(tagsFilter).toBeUndefined();
	});

	it("trims date values when switching to single-value operators", () => {
		const start = new Date("2024-01-01");
		const end = new Date("2024-03-01");
		const defaultFilters: FiltersState = [
			{
				columnId: "createdAt",
				type: "date",
				operator: "is between",
				values: [start, end],
			},
		];

		const { result } = renderHook(() =>
			useDataTableFilters({
				strategy: "client",
				data,
				filterDefinitions,
				defaultFilters,
			}),
		);

		act(() => {
			result.current.actions.setFilterOperator("createdAt", "is");
		});

		const dateFilter = result.current.filters.find((filter) => filter.columnId === "createdAt");
		expect(dateFilter?.operator).toBe("is");
		expect(dateFilter?.values).toEqual([start]);
	});

	it("normalizes number ranges when setting filter values", () => {
		const { result } = renderHook(() =>
			useDataTableFilters({
				strategy: "client",
				data,
				filterDefinitions,
			}),
		);

		const scoreColumn = result.current.filterColumns.find((column) => column.id === "score");
		if (!scoreColumn) {
			throw new Error("Expected score column to exist");
		}

		act(() => {
			result.current.actions.setFilterValue(scoreColumn, [20, 10]);
		});

		const scoreFilter = result.current.filters.find((filter) => filter.columnId === "score");
		expect(scoreFilter?.operator).toBe("is between");
		expect(scoreFilter?.values).toEqual([10, 20]);
	});

	it("clears filters with removeAllFilters", () => {
		const { result } = renderHook(() =>
			useDataTableFilters({
				strategy: "client",
				data,
				filterDefinitions,
				defaultFilters: [
					{
						columnId: "status",
						type: "option",
						operator: "is",
						values: ["active"],
					},
				],
			}),
		);

		act(() => {
			result.current.actions.removeAllFilters();
		});

		expect(result.current.filters).toEqual([]);
	});
});
