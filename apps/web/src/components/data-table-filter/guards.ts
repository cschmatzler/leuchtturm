import type { ColumnOption } from "@leuchtturm/web/components/data-table-filter/types";

export function isColumnOption(value: unknown): value is ColumnOption {
	return typeof value === "object" && value !== null && "value" in value && "label" in value;
}

export function isColumnOptionArray(value: unknown): value is ColumnOption[] {
	return Array.isArray(value) && value.every(isColumnOption);
}

export function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === "string");
}
