import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { createFilterColumns } from "@one/web/components/data-table-filter/filters";
import {
	createDateFilterValue,
	createNumberFilterValue,
	isColumnOptionArray,
	isColumnOptionMap,
	isMinMaxTuple,
} from "@one/web/components/data-table-filter/helpers";
import {
	dateFilterOperators,
	DEFAULT_OPERATORS,
	determineNewOperator,
} from "@one/web/components/data-table-filter/operators";
import type {
	ColumnConfig,
	ColumnDataType,
	ColumnOption,
	DataTableFilterActions,
	FilterModel,
	FiltersState,
	FilterStrategy,
	NumberColumnIds,
	OptionBasedColumnDataType,
	OptionColumnIds,
} from "@one/web/components/data-table-filter/types";
import { addUniq, removeUniq, uniq } from "@one/web/lib/array";

export interface DataTableFiltersOptions<
	TData,
	TColumns extends ReadonlyArray<ColumnConfig<TData, any, any, any>>,
	TStrategy extends FilterStrategy,
> {
	strategy: TStrategy;
	data: TData[];
	filterDefinitions: TColumns;
	defaultFilters?: FiltersState;
	filters?: FiltersState;
	onFiltersChange?: Dispatch<SetStateAction<FiltersState>>;
	options?: Partial<Record<OptionColumnIds<TColumns>, ColumnOption[] | undefined>>;
	faceted?: Partial<
		| Record<OptionColumnIds<TColumns>, Map<string, number> | undefined>
		| Record<NumberColumnIds<TColumns>, [number, number] | undefined>
	>;
}

function normalizeFilterModelValues<TType extends ColumnDataType>(
	type: TType,
	values: FilterModel<TType>["values"],
): FilterModel<TType>["values"] {
	if (type === "number") {
		return createNumberFilterValue(
			values as FilterModel<"number">["values"],
		) as FilterModel<TType>["values"];
	}

	if (type === "date") {
		return createDateFilterValue(
			values as Parameters<typeof createDateFilterValue>[0],
		) as FilterModel<TType>["values"];
	}

	return uniq(values) as FilterModel<TType>["values"];
}

function updateOptionFilterValues<TData, TType extends OptionBasedColumnDataType>({
	previousFilters,
	column,
	values,
	mode,
}: {
	previousFilters: FiltersState;
	column: ColumnConfig<TData, TType>;
	values: FilterModel<TType>["values"];
	mode: "add" | "remove";
}) {
	const filter = previousFilters.find((currentFilter) => currentFilter.columnId === column.id);

	if (!filter) {
		if (mode === "remove") {
			return [...previousFilters];
		}

		return [
			...previousFilters,
			{
				columnId: column.id,
				type: column.type,
				operator:
					values.length > 1
						? DEFAULT_OPERATORS[column.type].multiple
						: DEFAULT_OPERATORS[column.type].single,
				values,
			},
		];
	}

	const previousValues = filter.values;
	const nextValues =
		mode === "add" ? addUniq(filter.values, values) : removeUniq(filter.values, values);

	if (nextValues.length === 0) {
		return previousFilters.filter((currentFilter) => currentFilter.columnId !== column.id);
	}

	const nextOperator = determineNewOperator(
		column.type,
		previousValues,
		nextValues,
		filter.operator,
	);

	return previousFilters.map((currentFilter) =>
		currentFilter.columnId === column.id
			? {
					columnId: column.id,
					type: column.type,
					operator: nextOperator,
					values: nextValues,
				}
			: currentFilter,
	);
}

export function useDataTableFilters<
	TData,
	TColumns extends ReadonlyArray<ColumnConfig<TData, any, any, any>>,
	TStrategy extends FilterStrategy,
>({
	strategy,
	data,
	filterDefinitions,
	defaultFilters,
	filters: externalFilters,
	onFiltersChange,
	options,
	faceted,
}: DataTableFiltersOptions<TData, TColumns, TStrategy>) {
	const [internalFilters, setInternalFilters] = useState<FiltersState>(defaultFilters ?? []);

	if ((externalFilters && !onFiltersChange) || (!externalFilters && onFiltersChange)) {
		throw new Error(
			"If using controlled state, you must specify both filters and onFiltersChange.",
		);
	}

	const filters = externalFilters ?? internalFilters;
	const setFilters = onFiltersChange ?? setInternalFilters;

	// Convert ColumnConfig to Column, applying options and faceted options if provided
	const filterColumns = useMemo(() => {
		const resolvedDefinitions = filterDefinitions.map((config) => {
			let final = config;

			// Set options, if exists
			if (options && (config.type === "option" || config.type === "multiOption")) {
				const optionsInput = options[config.id as OptionColumnIds<TColumns>];
				if (!optionsInput || !isColumnOptionArray(optionsInput)) return config;

				final = { ...final, options: optionsInput };
			}

			// Set faceted options, if exists
			if (faceted && (config.type === "option" || config.type === "multiOption")) {
				const facetedOptionsInput = faceted[config.id as OptionColumnIds<TColumns>];
				if (!facetedOptionsInput || !isColumnOptionMap(facetedOptionsInput)) return config;

				final = { ...final, facetedOptions: facetedOptionsInput };
			}

			// Set faceted min/max values, if exists
			if (config.type === "number" && faceted) {
				const minMaxTuple = faceted[config.id as NumberColumnIds<TColumns>];
				if (!minMaxTuple || !isMinMaxTuple(minMaxTuple)) return config;

				final = {
					...final,
					min: minMaxTuple[0],
					max: minMaxTuple[1],
				};
			}

			return final;
		});

		return createFilterColumns(data, resolvedDefinitions, strategy);
	}, [data, filterDefinitions, options, faceted, strategy]);

	const actions: DataTableFilterActions = useMemo(
		() => ({
			addFilterValue<TData, TType extends OptionBasedColumnDataType>(
				column: ColumnConfig<TData, TType>,
				values: FilterModel<TType>["values"],
			) {
				if (column.type === "option" || column.type === "multiOption") {
					setFilters((prev) => {
						return updateOptionFilterValues({
							previousFilters: prev,
							column,
							values,
							mode: "add",
						});
					});
					return;
				}
				throw new Error(
					"[data-table-filter] addFilterValue() is only supported for option columns",
				);
			},
			removeFilterValue<TData, TType extends OptionBasedColumnDataType>(
				column: ColumnConfig<TData, TType>,
				value: FilterModel<TType>["values"],
			) {
				if (column.type === "option" || column.type === "multiOption") {
					setFilters((prev) => {
						return updateOptionFilterValues({
							previousFilters: prev,
							column,
							values: value,
							mode: "remove",
						});
					});
					return;
				}
				throw new Error(
					"[data-table-filter] removeFilterValue() is only supported for option columns",
				);
			},
			setFilterValue<TData, TType extends ColumnDataType>(
				column: ColumnConfig<TData, TType>,
				values: FilterModel<TType>["values"],
			) {
				setFilters((prev) => {
					const filter = prev.find((f) => f.columnId === column.id);
					const isColumnFiltered = filter && filter.values.length > 0;
					const newValues = normalizeFilterModelValues(column.type, values);
					if (newValues.length === 0) return prev;
					if (!isColumnFiltered) {
						return [
							...prev,
							{
								columnId: column.id,
								type: column.type,
								operator:
									values.length > 1
										? DEFAULT_OPERATORS[column.type].multiple
										: DEFAULT_OPERATORS[column.type].single,
								values: newValues,
							},
						];
					}
					const oldValues = filter.values;
					const newOperator = determineNewOperator(
						column.type,
						oldValues,
						newValues,
						filter.operator,
					);
					const newFilter = {
						columnId: column.id,
						type: column.type,
						operator: newOperator,
						values: newValues,
					} satisfies FilterModel<TType>;
					return prev.map((f) => (f.columnId === column.id ? newFilter : f));
				});
			},
			setFilterOperator<TType extends ColumnDataType>(
				columnId: string,
				operator: FilterModel<TType>["operator"],
			) {
				setFilters((prev) =>
					prev.map((f) => {
						if (f.columnId !== columnId) return f;

						if (f.type === "date") {
							const target =
								dateFilterOperators[operator as FilterModel<"date">["operator"]].target;
							const nextValues =
								target === "single" && f.values.length > 1 ? f.values.slice(0, 1) : f.values;
							return {
								...f,
								operator,
								values: nextValues as FilterModel<TType>["values"],
							};
						}

						return { ...f, operator };
					}),
				);
			},
			removeFilter(columnId: string) {
				setFilters((prev) => prev.filter((f) => f.columnId !== columnId));
			},
			removeAllFilters() {
				setFilters([]);
			},
		}),
		[setFilters],
	);

	return { filterColumns, filters, actions, strategy };
}
