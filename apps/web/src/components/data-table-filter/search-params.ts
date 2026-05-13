import { succeed } from "effect/Effect";
import {
	Any,
	Array as SchemaArray,
	is as isSchema,
	Literals,
	optional,
	String as SchemaString,
	Struct,
	withDecodingDefault,
} from "effect/Schema";

import type {
	ColumnDataType,
	FilterModel,
	FilterOperators,
	FiltersState,
} from "@leuchtturm/web/components/data-table-filter/types";

const filterModelSchema = Struct({
	columnId: SchemaString,
	type: Literals(["text", "number", "date", "option", "multiOption"]),
	operator: SchemaString,
	values: SchemaArray(Any),
});

const filtersStateArraySchema = SchemaArray(filterModelSchema);

export const filtersStateSchema = filtersStateArraySchema.pipe(
	optional,
	withDecodingDefault(succeed([])),
);

const isFiltersStateArray = isSchema(filtersStateArraySchema);

type FilterOperator = FilterOperators[ColumnDataType];

type ParsedFilterParamKey = {
	prefix: string;
	columnId: string;
	type: ColumnDataType;
	operator: FilterOperator;
};

type ParsedFilterParam = {
	prefix: string;
	filter: FilterModel;
};

const TYPE_CODES = {
	text: "t",
	number: "n",
	date: "d",
	option: "o",
	multiOption: "mo",
} as const satisfies Record<ColumnDataType, string>;

const CODE_TO_TYPE = Object.fromEntries(
	Object.entries(TYPE_CODES).map(([type, code]) => [code, type]),
) as Record<string, ColumnDataType>;

const OPERATOR_CODES = {
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
} as const satisfies Record<FilterOperator, string>;

const CODE_TO_OPERATOR = Object.fromEntries(
	Object.entries(OPERATOR_CODES).map(([operator, code]) => [code, operator]),
) as Record<string, FilterOperator>;

type FilterValueCodec = {
	encode: (values: FilterModel["values"]) => string;
	decode: (value: string) => FilterModel["values"];
};

const FILTER_VALUE_CODECS: Record<ColumnDataType, FilterValueCodec> = {
	text: {
		encode: encodeStringValues,
		decode: splitValues,
	},
	number: {
		encode: encodeStringValues,
		decode: (value) => splitValues(value).map((part) => Number(part)),
	},
	date: {
		encode: (values) => values.map(encodeDateValue).join(","),
		decode: (value) => splitValues(value).map((part) => new Date(part)),
	},
	option: {
		encode: encodeStringValues,
		decode: splitValues,
	},
	multiOption: {
		encode: encodeStringValues,
		decode: splitValues,
	},
};

function encodeType(type: ColumnDataType): string {
	return TYPE_CODES[type];
}

function decodeType(code: string): ColumnDataType | null {
	return CODE_TO_TYPE[code] ?? null;
}

function encodeOperator(operator: FilterOperator): string {
	return OPERATOR_CODES[operator] ?? operator;
}

function decodeOperator(code: string): FilterOperator {
	return (CODE_TO_OPERATOR[code] ?? code) as FilterOperator;
}

function stringifyFilterParamKey({
	prefix,
	columnId,
	type,
	operator,
}: ParsedFilterParamKey): string {
	return `${prefix}.${columnId}.${encodeType(type)}.${encodeOperator(operator)}`;
}

function parseFilterParamKey(paramKey: string): ParsedFilterParamKey | null {
	const parts = paramKey.split(".");
	if (parts.length < 4) return null;

	const type = decodeType(parts[2]);
	if (!type) return null;

	return {
		prefix: parts[0],
		columnId: parts[1],
		type,
		operator: decodeOperator(parts.slice(3).join(".")),
	};
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

function encodeStringValues(values: FilterModel["values"]): string {
	return values.map((value) => escapeValue(String(value))).join(",");
}

function encodeDateValue(value: FilterModel["values"][number]): string {
	if (Object.prototype.toString.call(value) === "[object Date]") {
		return value.toISOString().split("T")[0];
	}
	return escapeValue(String(value));
}

function encodeFilterValues(values: FilterModel["values"], type: ColumnDataType): string {
	return FILTER_VALUE_CODECS[type].encode(values);
}

function decodeFilterValues(value: string, type: ColumnDataType): FilterModel["values"] {
	return FILTER_VALUE_CODECS[type].decode(value);
}

export function isFiltersState(value: unknown): value is FiltersState {
	return isFiltersStateArray(value);
}

export function stringifyFilters(filters: FiltersState, prefix: string): Record<string, string> {
	const result: Record<string, string> = {};

	for (const filter of filters) {
		const type = filter.type as ColumnDataType;
		const paramKey = stringifyFilterParamKey({
			prefix,
			columnId: filter.columnId,
			type,
			operator: filter.operator,
		});
		result[paramKey] = encodeFilterValues(filter.values, type);
	}

	return result;
}

export function parseFilterParam(paramKey: string, value: string): ParsedFilterParam | null {
	const key = parseFilterParamKey(paramKey);
	if (!key) return null;

	return {
		prefix: key.prefix,
		filter: {
			columnId: key.columnId,
			type: key.type,
			operator: key.operator,
			values: decodeFilterValues(value, key.type),
		},
	};
}

export function parseFilters(params: Record<string, string>, prefix: string): FiltersState {
	const filters: FiltersState = [];

	for (const [paramKey, value] of Object.entries(params)) {
		const parsed = parseFilterParam(paramKey, value);
		if (!parsed) continue;
		if (parsed.prefix !== prefix) continue;

		filters.push(parsed.filter);
	}

	return filters;
}
