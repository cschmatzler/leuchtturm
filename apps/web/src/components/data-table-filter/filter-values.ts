import { isBefore } from "date-fns/isBefore";

export function createNumberFilterValue(values: number[] | undefined): number[] {
	if (!values || values.length === 0) return [];
	if (values.length === 1) return [values[0]];
	if (values.length === 2) return createNumberRange(values);
	return [values[0], values[1]];
}

export function createDateFilterValue(values: [Date, Date] | [Date] | [] | undefined) {
	if (!values || values.length === 0) return [];
	if (values.length === 1) return [values[0]];
	if (values.length === 2) return createDateRange(values);
	throw new Error("Cannot create date filter value from more than 2 values");
}

export function normalizeDateValue(value: unknown): Date | undefined {
	if (!value) return undefined;
	if (Object.prototype.toString.call(value) === "[object Date]") return value as Date;

	if (typeof value === "string" || typeof value === "number") {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}

	return undefined;
}

export function createDateRange(values: [Date, Date]) {
	const [a, b] = values;
	const [min, max] = isBefore(a, b) ? [a, b] : [b, a];

	return [min, max];
}

export function createNumberRange(values: number[] | undefined) {
	let a = 0;
	let b = 0;

	if (!values || values.length === 0) return [a, b];
	if (values.length === 1) {
		a = values[0];
	} else {
		a = values[0];
		b = values[1];
	}

	const [min, max] = a < b ? [a, b] : [b, a];

	return [min, max];
}
