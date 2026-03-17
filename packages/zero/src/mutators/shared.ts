import { type Transaction, defineMutatorsWithType } from "@rocicorp/zero";

import { ForbiddenError, UnauthorizedError } from "@chevrotain/core/errors";
import { type Context, type Schema } from "@chevrotain/zero/schema";

export const defineMutators = defineMutatorsWithType<Schema>();

export type Tx = Transaction<Schema, unknown>;

export function assertLoggedIn(ctx: Context): asserts ctx is { userId: string } {
	if (!ctx?.userId) throw new UnauthorizedError({ message: "Not logged in" });
}

export function assertOwnership<T extends { userId: string }>(
	entity: T | undefined,
	userId: string,
): asserts entity is T {
	if (!entity || entity.userId !== userId) {
		throw new ForbiddenError({ message: "Not owner" });
	}
}
