import { Circle } from "@phosphor-icons/react";
import { describe, expect, it } from "vite-plus/test";

import {
	createFilterBuilder,
	createFilterColumns,
	getColumnOptions,
	getColumnValues,
	getFacetedMinMaxValues,
	getFacetedUniqueValues,
} from "@leuchtturm/web/components/data-table-filter/filters";
import type {
	ColumnConfig,
	ColumnOption,
} from "@leuchtturm/web/components/data-table-filter/types";

type TestData = {
	id: string;
	name: string;
	age: number;
	status: string;
	tags: string[];
	createdAt: Date;
};

const testIcon = Circle;

describe("createFilterBuilder", () => {
	describe("text filter", () => {
		it("creates a text filter with required fields", () => {
			const builder = createFilterBuilder<TestData>();
			const filter = builder
				.text()
				.id("name")
				.accessor((d) => d.name)
				.displayName("Name")
				.icon(testIcon)
				.build();

			expect(filter.id).toBe("name");
			expect(filter.type).toBe("text");
			expect(filter.displayName).toBe("Name");
			expect(
				filter.accessor({
					id: "1",
					name: "Test",
					age: 25,
					status: "active",
					tags: [],
					createdAt: new Date(),
				}),
			).toBe("Test");
		});

		it("throws when required fields are missing", () => {
			const builder = createFilterBuilder<TestData>();
			expect(() => builder.text().build()).toThrow("id is required");
			expect(() => builder.text().id("name").build()).toThrow("accessor is required");
			expect(() =>
				builder
					.text()
					.id("name")
					.accessor((d) => d.name)
					.build(),
			).toThrow("displayName is required");
			expect(() =>
				builder
					.text()
					.id("name")
					.accessor((d) => d.name)
					.displayName("Name")
					.build(),
			).toThrow("icon is required");
		});
	});

	describe("number filter", () => {
		it("creates a number filter with min/max", () => {
			const builder = createFilterBuilder<TestData>();
			const filter = builder
				.number()
				.id("age")
				.accessor((d) => d.age)
				.displayName("Age")
				.icon(testIcon)
				.min(0)
				.max(120)
				.build();

			expect(filter.id).toBe("age");
			expect(filter.type).toBe("number");
			expect(filter.min).toBe(0);
			expect(filter.max).toBe(120);
		});
	});

	describe("date filter", () => {
		it("creates a date filter", () => {
			const builder = createFilterBuilder<TestData>();
			const filter = builder
				.date()
				.id("createdAt")
				.accessor((d) => d.createdAt)
				.displayName("Created At")
				.icon(testIcon)
				.build();

			expect(filter.id).toBe("createdAt");
			expect(filter.type).toBe("date");
		});
	});

	describe("option filter", () => {
		it("creates an option filter with static options", () => {
			const builder = createFilterBuilder<TestData>();
			const options: ColumnOption[] = [
				{ value: "active", label: "Active" },
				{ value: "inactive", label: "Inactive" },
			];
			const filter = builder
				.option()
				.id("status")
				.accessor((d) => d.status)
				.displayName("Status")
				.icon(testIcon)
				.options(options)
				.build();

			expect(filter.id).toBe("status");
			expect(filter.type).toBe("option");
			expect(filter.options).toEqual(options);
		});

		it("creates an option filter with transformOptionFn", () => {
			const builder = createFilterBuilder<TestData>();
			const transformFn = (value: string) => ({ value, label: value.toUpperCase() });
			const filter = builder
				.option()
				.id("status")
				.accessor((d) => d.status)
				.displayName("Status")
				.icon(testIcon)
				.transformOptionFn(transformFn)
				.build();

			expect(filter.transformOptionFn).toBe(transformFn);
		});

		it("creates an option filter with orderFn", () => {
			const builder = createFilterBuilder<TestData>();
			const orderFn = (a: string, b: string) => a.localeCompare(b);
			const filter = builder
				.option()
				.id("status")
				.accessor((d) => d.status)
				.displayName("Status")
				.icon(testIcon)
				.orderFn(orderFn)
				.build();

			expect(filter.orderFn).toBe(orderFn);
		});
	});

	describe("multiOption filter", () => {
		it("creates a multiOption filter", () => {
			const builder = createFilterBuilder<TestData>();
			const options: ColumnOption[] = [
				{ value: "tag1", label: "Tag 1" },
				{ value: "tag2", label: "Tag 2" },
			];
			const filter = builder
				.multiOption()
				.id("tags")
				.accessor((d) => d.tags)
				.displayName("Tags")
				.icon(testIcon)
				.options(options)
				.build();

			expect(filter.id).toBe("tags");
			expect(filter.type).toBe("multiOption");
			expect(filter.options).toEqual(options);
		});
	});

	describe("builder immutability", () => {
		it("returns a new builder instance on each method call", () => {
			const builder = createFilterBuilder<TestData>();
			const b1 = builder.text();
			const b2 = b1.id("name");
			const b3 = b2.displayName("Name");

			expect(b1).not.toBe(b2);
			expect(b2).not.toBe(b3);
		});
	});
});

describe("getColumnOptions", () => {
	const createOptionColumn = (
		options?: ColumnOption[],
	): ColumnConfig<TestData, "option", string> => ({
		id: "status",
		type: "option",
		accessor: (d) => d.status,
		displayName: "Status",
		icon: testIcon,
		options,
	});

	it("returns static options when provided", () => {
		const options: ColumnOption[] = [
			{ value: "active", label: "Active" },
			{ value: "inactive", label: "Inactive" },
		];
		const column = createOptionColumn(options);

		const result = getColumnOptions(column, [], "client");
		expect(result).toEqual(options);
	});

	it("throws for server strategy without static options", () => {
		const column = createOptionColumn();
		expect(() => getColumnOptions(column, [], "server")).toThrow(
			"column options are required for server-side filtering",
		);
	});

	it("extracts unique options from data when no static options", () => {
		const column: ColumnConfig<TestData, "option", string> = {
			id: "status",
			type: "option",
			accessor: (d) => d.status,
			displayName: "Status",
			icon: testIcon,
			transformOptionFn: (v) => ({ value: v, label: v }),
		};
		const data: TestData[] = [
			{ id: "1", name: "A", age: 25, status: "active", tags: [], createdAt: new Date() },
			{ id: "2", name: "B", age: 30, status: "inactive", tags: [], createdAt: new Date() },
			{ id: "3", name: "C", age: 35, status: "active", tags: [], createdAt: new Date() },
		];

		const result = getColumnOptions(column, data, "client");
		expect(result).toEqual([
			{ value: "active", label: "active" },
			{ value: "inactive", label: "inactive" },
		]);
	});

	it("throws for non-option column types", () => {
		const column: ColumnConfig<TestData, "text", string> = {
			id: "name",
			type: "text",
			accessor: (d) => d.name,
			displayName: "Name",
			icon: testIcon,
		};

		expect(() => getColumnOptions(column, [], "client")).toThrow(
			"Column options can only be retrieved for option and multiOption columns",
		);
	});
});

describe("getColumnValues", () => {
	it("extracts values from data using accessor", () => {
		const column: ColumnConfig<TestData, "text", string> = {
			id: "name",
			type: "text",
			accessor: (d) => d.name,
			displayName: "Name",
			icon: testIcon,
		};
		const data: TestData[] = [
			{ id: "1", name: "Alice", age: 25, status: "active", tags: [], createdAt: new Date() },
			{ id: "2", name: "Bob", age: 30, status: "inactive", tags: [], createdAt: new Date() },
		];

		const result = getColumnValues(column, data);
		expect(result).toEqual(["Alice", "Bob"]);
	});

	it("filters out null and undefined values", () => {
		const column: ColumnConfig<TestData, "text", string | null> = {
			id: "name",
			type: "text",
			accessor: (d) => (d.name === "skip" ? null : d.name),
			displayName: "Name",
			icon: testIcon,
		};
		const data: TestData[] = [
			{ id: "1", name: "Alice", age: 25, status: "active", tags: [], createdAt: new Date() },
			{ id: "2", name: "skip", age: 30, status: "inactive", tags: [], createdAt: new Date() },
			{ id: "3", name: "Bob", age: 35, status: "active", tags: [], createdAt: new Date() },
		];

		const result = getColumnValues(column, data);
		expect(result).toEqual(["Alice", "Bob"]);
	});
});

describe("getFacetedUniqueValues", () => {
	const createOptionColumn = (): ColumnConfig<TestData, "option", string> => ({
		id: "status",
		type: "option",
		accessor: (d) => d.status,
		displayName: "Status",
		icon: testIcon,
	});

	it("counts occurrences of each value", () => {
		const column = createOptionColumn();
		const values = ["active", "active", "inactive", "active"];

		const result = getFacetedUniqueValues(column, values, "client");

		expect(result?.get("active")).toBe(3);
		expect(result?.get("inactive")).toBe(1);
	});

	it("handles ColumnOption array", () => {
		const column = createOptionColumn();
		const values: ColumnOption[] = [
			{ value: "active", label: "Active" },
			{ value: "active", label: "Active" },
			{ value: "inactive", label: "Inactive" },
		];

		const result = getFacetedUniqueValues(column, values, "client");

		expect(result?.get("active")).toBe(2);
		expect(result?.get("inactive")).toBe(1);
	});

	it("returns facetedOptions for server strategy", () => {
		const facetedOptions = new Map([
			["active", 10],
			["inactive", 5],
		]);
		const column: ColumnConfig<TestData, "option", string> = {
			id: "status",
			type: "option",
			accessor: (d) => d.status,
			displayName: "Status",
			icon: testIcon,
			facetedOptions,
		};

		const result = getFacetedUniqueValues(column, [], "server");
		expect(result).toBe(facetedOptions);
	});

	it("throws for non-option column types", () => {
		const column: ColumnConfig<TestData, "text", string> = {
			id: "name",
			type: "text",
			accessor: (d) => d.name,
			displayName: "Name",
			icon: testIcon,
		};

		expect(() => getFacetedUniqueValues(column, [], "client")).toThrow(
			"Faceted unique values can only be retrieved for option and multiOption columns",
		);
	});
});

describe("getFacetedMinMaxValues", () => {
	const createNumberColumn = (
		min?: number,
		max?: number,
	): ColumnConfig<TestData, "number", number> => ({
		id: "age",
		type: "number",
		accessor: (d) => d.age,
		displayName: "Age",
		icon: testIcon,
		min,
		max,
	});

	it("returns static min/max when both provided", () => {
		const column = createNumberColumn(0, 100);
		const result = getFacetedMinMaxValues(column, [], "client");
		expect(result).toEqual([0, 100]);
	});

	it("calculates min/max from data", () => {
		const column = createNumberColumn();
		const data: TestData[] = [
			{ id: "1", name: "A", age: 25, status: "active", tags: [], createdAt: new Date() },
			{ id: "2", name: "B", age: 10, status: "active", tags: [], createdAt: new Date() },
			{ id: "3", name: "C", age: 50, status: "active", tags: [], createdAt: new Date() },
		];

		const result = getFacetedMinMaxValues(column, data, "client");
		expect(result).toEqual([10, 50]);
	});

	it("returns [0, 0] for empty data", () => {
		const column = createNumberColumn();
		const result = getFacetedMinMaxValues(column, [], "client");
		expect(result).toEqual([0, 0]);
	});

	it("returns undefined for server strategy without static min/max", () => {
		const column = createNumberColumn();
		const result = getFacetedMinMaxValues(column, [], "server");
		expect(result).toBeUndefined();
	});

	it("returns undefined for non-number column types", () => {
		const column: ColumnConfig<TestData, "text", string> = {
			id: "name",
			type: "text",
			accessor: (d) => d.name,
			displayName: "Name",
			icon: testIcon,
		};

		const result = getFacetedMinMaxValues(column, [], "client");
		expect(result).toBeUndefined();
	});

	it("filters out NaN values", () => {
		const column: ColumnConfig<TestData, "number", number> = {
			id: "age",
			type: "number",
			accessor: (d) => (d.age === 0 ? NaN : d.age),
			displayName: "Age",
			icon: testIcon,
		};
		const data: TestData[] = [
			{ id: "1", name: "A", age: 25, status: "active", tags: [], createdAt: new Date() },
			{ id: "2", name: "B", age: 0, status: "active", tags: [], createdAt: new Date() },
			{ id: "3", name: "C", age: 50, status: "active", tags: [], createdAt: new Date() },
		];

		const result = getFacetedMinMaxValues(column, data, "client");
		expect(result).toEqual([25, 50]);
	});
});

describe("createFilterColumns", () => {
	it("creates columns with getter functions", () => {
		const builder = createFilterBuilder<TestData>();
		const filterDefinitions = [
			builder
				.option()
				.id("status")
				.accessor((d) => d.status)
				.displayName("Status")
				.icon(testIcon)
				.options([
					{ value: "active", label: "Active" },
					{ value: "inactive", label: "Inactive" },
				])
				.build(),
		];

		const data: TestData[] = [
			{ id: "1", name: "A", age: 25, status: "active", tags: [], createdAt: new Date() },
			{ id: "2", name: "B", age: 30, status: "inactive", tags: [], createdAt: new Date() },
		];

		const columns = createFilterColumns(data, filterDefinitions, "client");

		expect(columns).toHaveLength(1);
		expect(columns[0].id).toBe("status");
		expect(typeof columns[0].getOptions).toBe("function");
		expect(typeof columns[0].getValues).toBe("function");
		expect(typeof columns[0].getFacetedUniqueValues).toBe("function");
		expect(typeof columns[0].getFacetedMinMaxValues).toBe("function");
	});

	it("creates columns with prefetch functions for client strategy", () => {
		const builder = createFilterBuilder<TestData>();
		const filterDefinitions = [
			builder
				.option()
				.id("status")
				.accessor((d) => d.status)
				.displayName("Status")
				.icon(testIcon)
				.options([{ value: "active", label: "Active" }])
				.build(),
		];

		const columns = createFilterColumns([], filterDefinitions, "client");

		expect(typeof columns[0].prefetchOptions).toBe("function");
		expect(typeof columns[0].prefetchValues).toBe("function");
		expect(typeof columns[0].prefetchFacetedUniqueValues).toBe("function");
		expect(typeof columns[0].prefetchFacetedMinMaxValues).toBe("function");
	});
});
