import {
	createDateFilterValue,
	createNumberFilterValue,
} from "@leuchtturm/web/components/data-table-filter/filter-values";
import {
	dateFilterOperators,
	DEFAULT_OPERATORS,
	determineNewOperator,
} from "@leuchtturm/web/components/data-table-filter/operators";
import type {
	ColumnConfig,
	ColumnDataType,
	FilterModel,
	FiltersState,
	OptionBasedColumnDataType,
} from "@leuchtturm/web/components/data-table-filter/types";
import { addUniq, removeUniq, uniq } from "@leuchtturm/web/lib/array";

type AnyColumnConfig = ColumnConfig<any, any, any, any>;

export type FilterStateAction =
	| {
			type: "addFilterValue";
			column: AnyColumnConfig;
			values: FilterModel<OptionBasedColumnDataType>["values"];
	  }
	| {
			type: "removeFilterValue";
			column: AnyColumnConfig;
			values: FilterModel<OptionBasedColumnDataType>["values"];
	  }
	| {
			type: "setFilterValue";
			column: AnyColumnConfig;
			values: FilterModel<ColumnDataType>["values"];
	  }
	| {
			type: "setFilterOperator";
			columnId: string;
			operator: FilterModel<ColumnDataType>["operator"];
	  }
	| { type: "removeFilter"; columnId: string }
	| { type: "removeAllFilters" };

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

function setFilterValue<TData, TType extends ColumnDataType>({
	previousFilters,
	column,
	values,
}: {
	previousFilters: FiltersState;
	column: ColumnConfig<TData, TType>;
	values: FilterModel<TType>["values"];
}) {
	const filter = previousFilters.find((f) => f.columnId === column.id);
	const isColumnFiltered = filter && filter.values.length > 0;
	const newValues = normalizeFilterModelValues(column.type, values);
	if (newValues.length === 0) return previousFilters;
	if (!isColumnFiltered) {
		return [
			...previousFilters,
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
	const newOperator = determineNewOperator(column.type, oldValues, newValues, filter.operator);
	const newFilter = {
		columnId: column.id,
		type: column.type,
		operator: newOperator,
		values: newValues,
	} satisfies FilterModel<TType>;
	return previousFilters.map((f) => (f.columnId === column.id ? newFilter : f));
}

export function updateFilters(
	previousFilters: FiltersState,
	action: FilterStateAction,
): FiltersState {
	switch (action.type) {
		case "addFilterValue": {
			if (action.column.type !== "option" && action.column.type !== "multiOption") {
				throw new Error(
					"[data-table-filter] addFilterValue() is only supported for option columns",
				);
			}

			return updateOptionFilterValues({
				previousFilters,
				column: action.column,
				values: action.values,
				mode: "add",
			});
		}
		case "removeFilterValue": {
			if (action.column.type !== "option" && action.column.type !== "multiOption") {
				throw new Error(
					"[data-table-filter] removeFilterValue() is only supported for option columns",
				);
			}

			return updateOptionFilterValues({
				previousFilters,
				column: action.column,
				values: action.values,
				mode: "remove",
			});
		}
		case "setFilterValue":
			return setFilterValue({
				previousFilters,
				column: action.column,
				values: action.values,
			});
		case "setFilterOperator":
			return previousFilters.map((filter) => {
				if (filter.columnId !== action.columnId) return filter;

				if (filter.type === "date") {
					const target =
						dateFilterOperators[action.operator as FilterModel<"date">["operator"]].target;
					const nextValues =
						target === "single" && filter.values.length > 1
							? filter.values.slice(0, 1)
							: filter.values;
					return {
						...filter,
						operator: action.operator,
						values: nextValues,
					};
				}

				return { ...filter, operator: action.operator };
			});
		case "removeFilter":
			return previousFilters.filter((filter) => filter.columnId !== action.columnId);
		case "removeAllFilters":
			return [];
	}
}
