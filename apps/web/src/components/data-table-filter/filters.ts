import type { Icon } from "@phosphor-icons/react/lib";

import { isColumnOptionArray } from "@leuchtturm/web/components/data-table-filter/guards";
import type {
	Column,
	ColumnConfig,
	ColumnDataType,
	ColumnOption,
	ElementType,
	Nullable,
	TAccessorFn,
	TOrderFn,
	TTransformOptionFn,
} from "@leuchtturm/web/components/data-table-filter/types";
import { isAnyOf, uniq } from "@leuchtturm/web/lib/array";
import { memo } from "@leuchtturm/web/lib/memo";

export type NumberColumnType<TType extends ColumnDataType> = TType extends "number" ? TType : never;

export type OptionColumnType<TType extends ColumnDataType> = TType extends "option" | "multiOption"
	? TType
	: never;

class FilterBuilder<
	TData,
	TType extends ColumnDataType = any,
	TVal = unknown,
	TId extends string = string,
> {
	private config: Partial<ColumnConfig<TData, TType, TVal, TId>>;

	constructor(type: TType) {
		this.config = { type };
	}

	private clone(): FilterBuilder<TData, TType, TVal, TId> {
		return this.cloneWith<TType, TVal, TId>();
	}

	private cloneWith<
		TNewType extends ColumnDataType = TType,
		TNewVal = TVal,
		TNewId extends string = TId,
	>(): FilterBuilder<TData, TNewType, TNewVal, TNewId> {
		const columnType = this.config.type;
		if (!columnType) {
			throw new Error("Type is required.");
		}

		const newInstance = new FilterBuilder<TData, TNewType, TNewVal, TNewId>(
			columnType as unknown as TNewType,
		);
		newInstance.config = {
			...this.config,
		} as Partial<ColumnConfig<TData, TNewType, TNewVal, TNewId>>;
		return newInstance;
	}

	id<TNewId extends string>(value: TNewId): FilterBuilder<TData, TType, TVal, TNewId> {
		const newInstance = this.cloneWith<TType, TVal, TNewId>();
		newInstance.config.id = value;
		return newInstance;
	}

	accessor<TNewVal>(
		accessor: TAccessorFn<TData, TNewVal>,
	): FilterBuilder<TData, TType, TNewVal, TId> {
		const newInstance = this.cloneWith<TType, TNewVal, TId>();
		newInstance.config.accessor = accessor;
		return newInstance;
	}

	displayName(value: string): FilterBuilder<TData, TType, TVal, TId> {
		const newInstance = this.clone();
		newInstance.config.displayName = value;
		return newInstance;
	}

	icon(value: Icon): FilterBuilder<TData, TType, TVal, TId> {
		const newInstance = this.clone();
		newInstance.config.icon = value;
		return newInstance;
	}

	min(value: number): FilterBuilder<TData, NumberColumnType<TType>, TVal, TId> {
		if (this.config.type !== "number") {
			throw new Error("min() is only applicable to number columns.");
		}
		const newInstance = this.cloneWith<NumberColumnType<TType>, TVal, TId>();
		newInstance.config.min = value;
		return newInstance;
	}

	max(value: number): FilterBuilder<TData, NumberColumnType<TType>, TVal, TId> {
		if (this.config.type !== "number") {
			throw new Error("max() is only applicable to number columns.");
		}
		const newInstance = this.cloneWith<NumberColumnType<TType>, TVal, TId>();
		newInstance.config.max = value;
		return newInstance;
	}

	options(value: ColumnOption[]): FilterBuilder<TData, OptionColumnType<TType>, TVal, TId> {
		if (!isAnyOf(this.config.type, ["option", "multiOption"])) {
			throw new Error("options() is only applicable to option or multiOption columns.");
		}
		const newInstance = this.cloneWith<OptionColumnType<TType>, TVal, TId>();
		newInstance.config.options = value;
		return newInstance;
	}

	transformOptionFn(
		fn: TTransformOptionFn<TVal>,
	): FilterBuilder<TData, OptionColumnType<TType>, TVal, TId> {
		if (!isAnyOf(this.config.type, ["option", "multiOption"])) {
			throw new Error("transformOptionFn() is only applicable to option or multiOption columns.");
		}
		const newInstance = this.cloneWith<OptionColumnType<TType>, TVal, TId>();
		newInstance.config.transformOptionFn = fn;
		return newInstance;
	}

	orderFn(fn: TOrderFn<TVal>): FilterBuilder<TData, OptionColumnType<TType>, TVal, TId> {
		if (!isAnyOf(this.config.type, ["option", "multiOption"])) {
			throw new Error("orderFn() is only applicable to option or multiOption columns.");
		}
		const newInstance = this.cloneWith<OptionColumnType<TType>, TVal, TId>();
		newInstance.config.orderFn = fn;
		return newInstance;
	}

	build(): ColumnConfig<TData, TType, TVal, TId> {
		if (!this.config.id) throw new Error("id is required.");
		if (!this.config.accessor) throw new Error("accessor is required.");
		if (!this.config.displayName) throw new Error("displayName is required.");
		if (!this.config.icon) throw new Error("icon is required.");
		return this.config as ColumnConfig<TData, TType, TVal, TId>;
	}
}

export interface FluentColumnConfigHelper<TData> {
	text: () => FilterBuilder<TData, "text", string>;
	number: () => FilterBuilder<TData, "number", number>;
	date: () => FilterBuilder<TData, "date", Date>;
	option: () => FilterBuilder<TData, "option", string>;
	multiOption: () => FilterBuilder<TData, "multiOption", string[]>;
}

export function createFilterBuilder<TData>(): FluentColumnConfigHelper<TData> {
	return {
		text: () => new FilterBuilder<TData, "text", string>("text"),
		number: () => new FilterBuilder<TData, "number", number>("number"),
		date: () => new FilterBuilder<TData, "date", Date>("date"),
		option: () => new FilterBuilder<TData, "option", string>("option"),
		multiOption: () => new FilterBuilder<TData, "multiOption", string[]>("multiOption"),
	};
}

export function getColumnOptions<TData, TType extends ColumnDataType, TVal>(
	column: ColumnConfig<TData, TType, TVal>,
	data: TData[],
): ColumnOption[] {
	if (!isAnyOf(column.type, ["option", "multiOption"])) {
		throw new Error("Column options can only be retrieved for option and multiOption columns.");
	}

	if (column.options) {
		return column.options;
	}

	const filtered = data
		.flatMap(column.accessor)
		.filter((v): v is NonNullable<TVal> => v !== undefined && v !== null);

	let models = uniq(filtered);

	if (column.orderFn) {
		models = models.sort((m1, m2) =>
			column.orderFn!(m1 as ElementType<NonNullable<TVal>>, m2 as ElementType<NonNullable<TVal>>),
		);
	}

	if (column.transformOptionFn) {
		const memoizedTransform = memo(
			() => [models],
			(deps) => deps[0].map((m) => column.transformOptionFn!(m as ElementType<NonNullable<TVal>>)),
		);
		return memoizedTransform();
	}

	if (isColumnOptionArray(models)) return models;

	throw new Error(
		`[data-table-filter] [${column.id}] Either provide static options, a transformOptionFn, or ensure the column data conforms to ColumnOption type.`,
	);
}

export function getColumnValues<TData, TType extends ColumnDataType, TVal>(
	column: ColumnConfig<TData, TType, TVal>,
	data: TData[],
) {
	const memoizedAccessor = memo(
		() => [data],
		(deps) =>
			deps[0]
				.flatMap(column.accessor)
				.filter((v): v is NonNullable<TVal> => v !== undefined && v !== null) as ElementType<
				NonNullable<TVal>
			>[],
	);

	const raw = memoizedAccessor();

	if (!isAnyOf(column.type, ["option", "multiOption"])) {
		return raw;
	}

	if (column.options) {
		return raw
			.map((v: ElementType<NonNullable<TVal>>) => column.options?.find((o) => o.value === v)?.value)
			.filter((v): v is string => v !== undefined && v !== null);
	}

	if (column.transformOptionFn) {
		const memoizedTransform = memo(
			() => [raw],
			(deps) =>
				deps[0].map(
					(v: ElementType<NonNullable<TVal>>) =>
						column.transformOptionFn!(v) as ElementType<NonNullable<TVal>>,
				),
		);
		return memoizedTransform();
	}

	if (isColumnOptionArray(raw)) {
		return raw;
	}

	throw new Error(
		`[data-table-filter] [${column.id}] Either provide static options, a transformOptionFn, or ensure the column data conforms to ColumnOption type.`,
	);
}

export function getFacetedUniqueValues<TData, TType extends ColumnDataType, TVal>(
	column: ColumnConfig<TData, TType, TVal>,
	values: string[] | ColumnOption[],
): Map<string, number> | undefined {
	if (!isAnyOf(column.type, ["option", "multiOption"])) {
		throw new Error(
			"Faceted unique values can only be retrieved for option and multiOption columns.",
		);
	}

	const acc = new Map<string, number>();

	for (const option of values) {
		const key = typeof option === "string" ? option : option.value;
		const count = acc.get(key) ?? 0;
		acc.set(key, count + 1);
	}

	return acc;
}

export function getFacetedMinMaxValues<TData, TType extends ColumnDataType, TVal>(
	column: ColumnConfig<TData, TType, TVal>,
	data: TData[],
): [number, number] | undefined {
	if (column.type !== "number") return undefined;

	if (typeof column.min === "number" && typeof column.max === "number") {
		return [column.min, column.max];
	}

	const values = data
		.flatMap((row) => column.accessor(row) as Nullable<number>)
		.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

	if (values.length === 0) {
		return [0, 0];
	}

	const min = Math.min(...values);
	const max = Math.max(...values);

	return [min, max];
}

export function createFilterColumns<TData>(
	data: TData[],
	filterDefinitions: ReadonlyArray<ColumnConfig<TData, any, any, any>>,
): Column<TData>[] {
	return filterDefinitions.map((columnConfig) => {
		const getOptions: () => ColumnOption[] = memo(
			() => [data, columnConfig.options] as const,
			([data]) => getColumnOptions(columnConfig, data),
		);

		const getValues: () => ElementType<NonNullable<any>>[] = memo(
			() => [data],
			([data]) => getColumnValues(columnConfig, data),
		);

		const getUniqueValues: () => Map<string, number> | undefined = memo(
			() => [getValues()] as const,
			([values]) => getFacetedUniqueValues(columnConfig, values),
		);

		const getMinMaxValues: () => [number, number] | undefined = memo(
			() => [data, columnConfig.min, columnConfig.max] as const,
			([data]) => getFacetedMinMaxValues(columnConfig, data),
		);

		let prefetched = false;

		return {
			...columnConfig,
			getOptions,
			getFacetedUniqueValues: getUniqueValues,
			getFacetedMinMaxValues: getMinMaxValues,
			prefetch: async (): Promise<void> => {
				if (prefetched) return;

				await new Promise((resolve) =>
					setTimeout(() => {
						if (isAnyOf(columnConfig.type, ["option", "multiOption"])) {
							getOptions();
							getValues();
							getUniqueValues();
						}

						if (columnConfig.type === "number") {
							getMinMaxValues();
						}

						prefetched = true;
						resolve(undefined);
					}, 0),
				);
			},
		};
	});
}
