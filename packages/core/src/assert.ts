import { Effect } from "effect";

import { NotFoundError } from "@chevrotain/core/errors";
import { PublicError } from "@chevrotain/core/result";

/** Throwing assertion for use in Zero mutators and non-Effect code. */
export function assert<T>(value: T | null | undefined): asserts value is T {
	if (value == null) {
		throw new PublicError({ status: 404, global: [{ message: "Not found" }] });
	}
}

/** Effect-native assertion — returns `Effect.fail(NotFoundError)` instead of throwing. */
export const assertFound = <T>(
	value: T | null | undefined,
	resource?: string,
): Effect.Effect<T, NotFoundError> =>
	value != null ? Effect.succeed(value) : Effect.fail(new NotFoundError({ resource }));
