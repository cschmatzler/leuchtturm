import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { updateFilters } from "@leuchtturm/web/components/data-table-filter/filter-state";
import { createFilterColumns } from "@leuchtturm/web/components/data-table-filter/filters";
import type {
	ColumnConfig,
	ColumnDataType,
	DataTableFilterActions,
	FilterModel,
	FiltersState,
	OptionBasedColumnDataType,
} from "@leuchtturm/web/components/data-table-filter/types";

export interface DataTableFiltersOptions<
	TData,
	TColumns extends ReadonlyArray<ColumnConfig<TData, any, any, any>>,
> {
	data: TData[];
	filterDefinitions: TColumns;
	defaultFilters?: FiltersState;
	filters?: FiltersState;
	onFiltersChange?: Dispatch<SetStateAction<FiltersState>>;
}

export function useDataTableFilters<
	TData,
	TColumns extends ReadonlyArray<ColumnConfig<TData, any, any, any>>,
>({
	data,
	filterDefinitions,
	defaultFilters,
	filters: externalFilters,
	onFiltersChange,
}: DataTableFiltersOptions<TData, TColumns>) {
	const [internalFilters, setInternalFilters] = useState<FiltersState>(defaultFilters ?? []);

	if ((externalFilters && !onFiltersChange) || (!externalFilters && onFiltersChange)) {
		throw new Error(
			"If using controlled state, you must specify both filters and onFiltersChange.",
		);
	}

	const filters = externalFilters ?? internalFilters;
	const setFilters = onFiltersChange ?? setInternalFilters;

	const filterColumns = useMemo(
		() => createFilterColumns(data, filterDefinitions),
		[data, filterDefinitions],
	);

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

	return { filterColumns, filters, actions };
}
