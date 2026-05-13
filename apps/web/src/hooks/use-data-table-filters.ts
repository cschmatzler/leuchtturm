import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { updateFilters } from "@leuchtturm/web/components/data-table-filter/filter-state";
import { createFilterColumns } from "@leuchtturm/web/components/data-table-filter/filters";
import {
	isColumnOptionArray,
	isColumnOptionMap,
	isMinMaxTuple,
} from "@leuchtturm/web/components/data-table-filter/guards";
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
} from "@leuchtturm/web/components/data-table-filter/types";

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
				setFilters((prev) => updateFilters(prev, { type: "addFilterValue", column, values }));
			},
			removeFilterValue<TData, TType extends OptionBasedColumnDataType>(
				column: ColumnConfig<TData, TType>,
				values: FilterModel<TType>["values"],
			) {
				setFilters((prev) => updateFilters(prev, { type: "removeFilterValue", column, values }));
			},
			setFilterValue<TData, TType extends ColumnDataType>(
				column: ColumnConfig<TData, TType>,
				values: FilterModel<TType>["values"],
			) {
				setFilters((prev) => updateFilters(prev, { type: "setFilterValue", column, values }));
			},
			setFilterOperator<TType extends ColumnDataType>(
				columnId: string,
				operator: FilterModel<TType>["operator"],
			) {
				setFilters((prev) =>
					updateFilters(prev, { type: "setFilterOperator", columnId, operator }),
				);
			},
			removeFilter(columnId: string) {
				setFilters((prev) => updateFilters(prev, { type: "removeFilter", columnId }));
			},
			removeAllFilters() {
				setFilters((prev) => updateFilters(prev, { type: "removeAllFilters" }));
			},
		}),
		[setFilters],
	);

	return { filterColumns, filters, actions, strategy };
}
