import { type Transaction, defineMutatorsWithType } from "@rocicorp/zero";

import { PublicError } from "@roasted/core/result";
import { type Context, type Schema } from "@roasted/zero/schema";

export const defineMutators = defineMutatorsWithType<Schema>();

export type Tx = Transaction<Schema, unknown>;

export function assertLoggedIn(ctx: Context): asserts ctx is { userId: string } {
	if (!ctx?.userId) throw new PublicError({ status: 401 });
}

export function assertOwnership<T extends { userId: string }>(
	entity: T | undefined,
	userId: string,
): asserts entity is T {
	if (!entity || entity.userId !== userId) {
		throw new PublicError({ status: 403 });
	}
}
