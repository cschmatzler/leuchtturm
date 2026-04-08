import type { ColumnDef, ColumnFiltersState, Row } from "@tanstack/react-table";

import {
	multiOptionFilterFn,
	optionFilterFn,
} from "@leuchtturm/web/components/data-table-filter/filter-fns";
import * as f from "@leuchtturm/web/components/data-table-filter/filter-fns";
import {
	isColumnOption,
	isColumnOptionArray,
	isStringArray,
} from "@leuchtturm/web/components/data-table-filter/helpers";
import type {
	Column,
	FilterModel,
	FiltersState,
} from "@leuchtturm/web/components/data-table-filter/types";

interface CreateTanStackColumnsOptions<TData> {
	columns: ColumnDef<TData, any>[];
	filterColumns: Column<TData>[];
}

function dateFilterFn<TData>(
	row: Row<TData>,
	columnId: string,
	filterValue: FilterModel<"date">,
): boolean {
	const value = row.getValue<Date>(columnId);

	return f.dateFilterFn(value, filterValue);
}

function textFilterFn<TData>(
	row: Row<TData>,
	columnId: string,
	filterValue: FilterModel<"text">,
): boolean {
	const value = row.getValue<string>(columnId) ?? "";

	return f.textFilterFn(value, filterValue);
}

function numberFilterFn<TData>(
	row: Row<TData>,
	columnId: string,
	filterValue: FilterModel<"number">,
): boolean {
	const value = row.getValue<number>(columnId);

	return f.numberFilterFn(value, filterValue);
}

export function createTanStackColumns<TData>({
	columns,
	filterColumns,
}: CreateTanStackColumnsOptions<TData>) {
	const _cols: ColumnDef<TData>[] = [];

	for (const col of columns) {
		const config = filterColumns.find((c) => c.id === col.id);

		if (col.enableColumnFilter === false || !config) {
			_cols.push(col);
			continue;
		}

		if (config.type === "text") {
			col.filterFn = textFilterFn;
			_cols.push(col);
			continue;
		}

		if (config.type === "number") {
			col.filterFn = numberFilterFn;
			_cols.push(col);
			continue;
		}

		if (config.type === "date") {
			col.filterFn = dateFilterFn;
			_cols.push(col);
			continue;
		}

		if (config.type === "option") {
			col.filterFn = (row, columnId, filterValue: FilterModel<"option">) => {
				const value = row.getValue<unknown>(columnId);

				if (!value) return false;

				if (typeof value === "string") {
					return optionFilterFn(value, filterValue);
				}

				if (isColumnOption(value)) {
					return optionFilterFn(value.value, filterValue);
				}

				const sanitizedValue = config.transformOptionFn!(value as never);
				return optionFilterFn(sanitizedValue.value, filterValue);
			};
		}

		if (config.type === "multiOption") {
			col.filterFn = (row, columnId, filterValue: FilterModel<"multiOption">) => {
				const value = row.getValue(columnId);

				if (!value) return false;

				if (isStringArray(value)) {
					return multiOptionFilterFn(value, filterValue);
				}

				if (isColumnOptionArray(value)) {
					return multiOptionFilterFn(
						value.map((v) => v.value),
						filterValue,
					);
				}

				const sanitizedValue = (value as never[]).map((v) => config.transformOptionFn!(v));

				return multiOptionFilterFn(
					sanitizedValue.map((v) => v.value),
					filterValue,
				);
			};
		}

		_cols.push(col);
	}

	return _cols;
}

export function createTanStackFilters(filters: FiltersState): ColumnFiltersState {
	return filters.map((filter) => ({ id: filter.columnId, value: filter }));
}
