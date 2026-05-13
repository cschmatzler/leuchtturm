import {
	isFiltersState,
	parseFilterParam,
	stringifyFilters,
} from "@leuchtturm/web/components/data-table-filter/search-params";
import type { FiltersState } from "@leuchtturm/web/components/data-table-filter/types";

function parseScalarValue(value: string): unknown {
	if (value === "true") return true;
	if (value === "false") return false;
	if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
	return value;
}

function stringifyScalarValue(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return JSON.stringify(value);
}

export function parseSearch(searchStr: string): Record<string, unknown> {
	if (searchStr.startsWith("?")) {
		searchStr = searchStr.slice(1);
	}

	const params = new URLSearchParams(searchStr);
	const result: Record<string, unknown> = {};
	const filtersByPrefix = new Map<string, FiltersState>();

	for (const [key, value] of params) {
		const parsedFilter = parseFilterParam(key, value);
		if (!parsedFilter) {
			result[key] = parseScalarValue(value);
			continue;
		}

		const filters = filtersByPrefix.get(parsedFilter.prefix);
		if (filters) {
			filters.push(parsedFilter.filter);
		} else {
			filtersByPrefix.set(parsedFilter.prefix, [parsedFilter.filter]);
		}
	}

	for (const [prefix, filters] of filtersByPrefix) {
		result[prefix] = filters;
	}

	return result;
}

export function stringifySearch(search: Record<string, unknown>): string {
	const params = new URLSearchParams();

	for (const [key, value] of Object.entries(search)) {
		if (value == null) continue;

		if (isFiltersState(value)) {
			const filterParams = stringifyFilters(value, key);
			for (const [filterKey, filterValue] of Object.entries(filterParams)) {
				params.set(filterKey, filterValue);
			}
		} else {
			params.set(key, stringifyScalarValue(value));
		}
	}

	const str = params.toString();
	return str ? `?${str}` : "";
}
