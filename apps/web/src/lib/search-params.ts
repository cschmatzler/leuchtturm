import { Schema } from "effect";

import type {
	ColumnDataType,
	FilterModel,
	FiltersState,
} from "@chevrotain/web/components/data-table-filter/types";

const filterModelSchema = Schema.Struct({
	columnId: Schema.String,
	type: Schema.Literals(["text", "number", "date", "option", "multiOption"]),
	operator: Schema.String,
	values: Schema.Array(Schema.Unknown),
});

export const filtersStateSchema = Schema.toStandardSchemaV1(Schema.Array(filterModelSchema));

const TYPE_CODES = {
	text: "t",
	number: "n",
	date: "d",
	option: "o",
	multiOption: "mo",
} as const satisfies Record<ColumnDataType, string>;

const CODE_TO_TYPE = Object.fromEntries(
	Object.entries(TYPE_CODES).map(([k, v]) => [v, k]),
) as Record<string, ColumnDataType>;

function encodeType(type: ColumnDataType): string {
	return TYPE_CODES[type];
}

function decodeType(code: string): ColumnDataType | null {
	return CODE_TO_TYPE[code] ?? null;
}

const OPERATOR_CODES: Record<string, string> = {
	contains: "c",
	"does not contain": "nc",
	is: "eq",
	"is not": "neq",
	"is less than": "lt",
	"is greater than": "gt",
	"is less than or equal to": "lte",
	"is greater than or equal to": "gte",
	"is between": "between",
	"is not between": "nbetween",
	"is before": "before",
	"is after": "after",
	"is on or before": "onOrBefore",
	"is on or after": "onOrAfter",
	"is any of": "anyOf",
	"is none of": "noneOf",
	include: "inc",
	exclude: "exc",
	"include any of": "incAny",
	"include all of": "incAll",
	"exclude if any of": "excAny",
	"exclude if all": "excAll",
};

const CODE_TO_OPERATOR = Object.fromEntries(Object.entries(OPERATOR_CODES).map(([k, v]) => [v, k]));

function encodeOperator(operator: string): string {
	return OPERATOR_CODES[operator] ?? operator;
}

function decodeOperator(code: string): string {
	return CODE_TO_OPERATOR[code] ?? code;
}

function buildFilterKey({
	prefix,
	columnId,
	typeCode,
	operatorCode,
}: {
	prefix: string;
	columnId: string;
	typeCode: string;
	operatorCode: string;
}): string {
	return `${prefix}.${columnId}.${typeCode}.${operatorCode}`;
}

function escapeValue(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/\./g, "\\.");
}

function unescapeValue(value: string): string {
	return value.replace(/\\,/g, ",").replace(/\\\./g, ".").replace(/\\\\/g, "\\");
}

function splitValues(value: string): string[] {
	const result: string[] = [];
	let current = "";
	let escaped = false;

	for (const char of value) {
		if (escaped) {
			current += char;
			escaped = false;
		} else if (char === "\\") {
			current += char;
			escaped = true;
		} else if (char === ",") {
			result.push(unescapeValue(current));
			current = "";
		} else {
			current += char;
		}
	}
	result.push(unescapeValue(current));
	return result;
}

function encodeFilterValues(values: FilterModel["values"], type: ColumnDataType): string {
	return values
		.map((v) => {
			if (type === "date" && v instanceof Date) {
				return v.toISOString().split("T")[0];
			}
			return escapeValue(String(v));
		})
		.join(",");
}

function decodeFilterValues(valueStr: string, type: ColumnDataType): FilterModel["values"] {
	const parts = splitValues(valueStr);

	switch (type) {
		case "number":
			return parts.map((p) => Number(p));
		case "date":
			return parts.map((p) => new Date(p));
		default:
			return parts;
	}
}

export function stringifyFilters(filters: FiltersState, prefix: string): Record<string, string> {
	const result: Record<string, string> = {};

	for (const filter of filters) {
		const filterType = filter.type as ColumnDataType;
		const typeCode = encodeType(filterType);
		const operatorCode = encodeOperator(filter.operator);
		const paramKey = buildFilterKey({
			prefix,
			columnId: filter.columnId,
			typeCode,
			operatorCode,
		});
		result[paramKey] = encodeFilterValues(filter.values, filterType);
	}

	return result;
}

export function parseFilters(params: Record<string, string>, prefix: string): FiltersState {
	const filters: FiltersState = [];

	for (const [paramKey, value] of Object.entries(params)) {
		const info = parseFilterKey(paramKey);
		if (!info) continue;
		if (info.prefix !== prefix) continue;

		const type = decodeType(info.typeCode);
		if (!type) continue;

		const operator = decodeOperator(info.operatorCode);
		const values = decodeFilterValues(value, type);

		filters.push({
			columnId: info.columnId,
			type,
			operator: operator as FilterModel["operator"],
			values,
		});
	}

	return filters;
}

function parseFilterKey(
	paramKey: string,
): { prefix: string; columnId: string; typeCode: string; operatorCode: string } | null {
	const parts = paramKey.split(".");
	if (parts.length < 4) return null;

	const prefix = parts[0];
	const columnId = parts[1];
	const typeCode = parts[2];
	const operatorCode = parts.slice(3).join(".");
	if (decodeType(typeCode)) return { prefix, columnId, typeCode, operatorCode };

	return null;
}

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
	const filterParams = new Map<string, Record<string, string>>();

	for (const [key, value] of params) {
		const filterInfo = parseFilterKey(key);
		if (filterInfo) {
			const { prefix } = filterInfo;
			if (!filterParams.has(prefix)) {
				filterParams.set(prefix, {});
			}
			filterParams.get(prefix)![key] = value;
		} else {
			result[key] = parseScalarValue(value);
		}
	}

	for (const [prefix, prefixParams] of filterParams) {
		result[prefix] = parseFilters(prefixParams, prefix);
	}

	return result;
}

function isFiltersState(value: unknown): value is FiltersState {
	if (!Array.isArray(value)) return false;
	if (value.length === 0) return true;

	const first = value[0];
	return (
		typeof first === "object" &&
		first !== null &&
		"columnId" in first &&
		"type" in first &&
		"operator" in first &&
		"values" in first
	);
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
