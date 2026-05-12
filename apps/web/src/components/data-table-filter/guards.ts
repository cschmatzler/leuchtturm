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

export function isColumnOptionMap(value: unknown): value is Map<string, number> {
	if (Object.prototype.toString.call(value) !== "[object Map]") {
		return false;
	}
	const map = value as Map<string, number>;
	for (const key of map.keys()) {
		if (typeof key !== "string") {
			return false;
		}
	}
	for (const entry of map.values()) {
		if (typeof entry !== "number") {
			return false;
		}
	}
	return true;
}

export function isMinMaxTuple(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		typeof value[0] === "number" &&
		typeof value[1] === "number"
	);
}
