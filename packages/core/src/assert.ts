import { PublicError } from "@one/core/result";

export function assert<T>(value: T | null | undefined): asserts value is T {
	if (value == null) {
		throw new PublicError({ status: 404, global: [{ message: "Not found" }] });
	}
}
