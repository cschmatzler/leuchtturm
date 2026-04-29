import { endOfDay, isAfter, isBefore, isSameDay, isWithinInterval, startOfDay } from "date-fns";
import { intersection } from "remeda";

import { normalizeDateValue } from "@leuchtturm/web/components/data-table-filter/helpers";
import { dateFilterOperators } from "@leuchtturm/web/components/data-table-filter/operators";
import type {
	ColumnDataType,
	FilterOperators,
	FilterValues,
} from "@leuchtturm/web/components/data-table-filter/types";

export type FilterInput<TType extends ColumnDataType, TValue = FilterValues<TType>> = {
	operator: FilterOperators[TType];
	values: TValue;
};

export type DateFilterInput = FilterInput<"date", Array<Date | string | number>>;

export function optionFilterFn(inputData: string, filterValue: FilterInput<"option">) {
	if (!inputData) return false;
	if (filterValue.values.length === 0) return true;

	const value = inputData.toString().toLowerCase();

	const found = !!filterValue.values.find((v) => v.toLowerCase() === value);

	switch (filterValue.operator) {
		case "is":
		case "is any of":
			return found;
		case "is not":
		case "is none of":
			return !found;
	}
}

export function multiOptionFilterFn(
	inputData: string[] | null | undefined,
	filterValue: FilterInput<"multiOption">,
) {
	if (!inputData) return false;

	if (
		filterValue.values.length === 0 ||
		!filterValue.values[0] ||
		filterValue.values[0].length === 0
	)
		return true;

	const values = inputData;
	const filterValues = filterValue.values;
	const intersectionLength = intersection(values, filterValues).length;

	switch (filterValue.operator) {
		case "include":
		case "include any of":
			return intersectionLength > 0;
		case "exclude":
			return intersectionLength === 0;
		case "exclude if any of":
			return intersectionLength === 0;
		case "include all of":
			return intersectionLength === filterValues.length;
		case "exclude if all":
			return intersectionLength !== filterValues.length;
	}
}

export function dateFilterFn(inputData: Date, filterValue?: DateFilterInput) {
	if (!filterValue || filterValue.values.length === 0) return true;

	const operatorDetails = dateFilterOperators[filterValue.operator];
	const normalizedValues = filterValue.values
		.map((value) => normalizeDateValue(value))
		.filter((value): value is Date => Boolean(value));

	if (normalizedValues.length === 0) return true;

	const d1 = normalizedValues[0];
	const d2 = normalizedValues[1];

	const value = inputData;

	if (operatorDetails.target === "single") {
		switch (filterValue.operator) {
			case "is":
				return isSameDay(value, d1);
			case "is not":
				return !isSameDay(value, d1);
			case "is before":
				return isBefore(value, startOfDay(d1));
			case "is on or after":
				return isSameDay(value, d1) || isAfter(value, startOfDay(d1));
			case "is after":
				return isAfter(value, endOfDay(d1));
			case "is on or before":
				return isSameDay(value, d1) || isBefore(value, startOfDay(d1));
			default:
				return true;
		}
	}

	if (!d2) return true;

	switch (filterValue.operator) {
		case "is between":
			return isWithinInterval(value, {
				start: startOfDay(d1),
				end: endOfDay(d2),
			});
		case "is not between":
			return !isWithinInterval(value, {
				start: startOfDay(d1),
				end: endOfDay(d2),
			});
		default:
			return true;
	}
}

export function textFilterFn(inputData: string, filterValue?: FilterInput<"text">) {
	if (!filterValue || filterValue.values.length === 0) return true;

	const value = inputData.toLowerCase().trim();
	const filterStr = filterValue.values[0].toLowerCase().trim();

	if (filterStr === "") return true;

	const found = value.includes(filterStr);

	switch (filterValue.operator) {
		case "contains":
			return found;
		case "does not contain":
			return !found;
	}
}

export function numberFilterFn(inputData: number, filterValue?: FilterInput<"number">) {
	if (!filterValue || !filterValue.values || filterValue.values.length === 0) {
		return true;
	}

	const value = inputData;
	const filterVal = filterValue.values[0];

	switch (filterValue.operator) {
		case "is":
			return value === filterVal;
		case "is not":
			return value !== filterVal;
		case "is greater than":
			return value > filterVal;
		case "is greater than or equal to":
			return value >= filterVal;
		case "is less than":
			return value < filterVal;
		case "is less than or equal to":
			return value <= filterVal;
		case "is between": {
			const lowerBound = filterValue.values[0];
			const upperBound = filterValue.values[1];
			return value >= lowerBound && value <= upperBound;
		}
		case "is not between": {
			const lowerBound = filterValue.values[0];
			const upperBound = filterValue.values[1];
			return value < lowerBound || value > upperBound;
		}
		default:
			return true;
	}
}
