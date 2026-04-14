import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Database } from "@leuchtturm/core/drizzle";
import { DatabaseError } from "@leuchtturm/core/errors";

export namespace HealthHandler {
	export const roundMilliseconds = (durationMs: number) => Math.round(durationMs * 1000) / 1000;

	export const healthCheck = Effect.fn("health.check")(function* () {
		const startedAt = performance.now();
		const { db } = yield* Database.Service;
		const databaseStartedAt = performance.now();

		yield* Effect.tryPromise({
			try: () => db.$client.query("select 1"),
			catch: (error) =>
				new DatabaseError({
					message: `Health database check failed: ${String(error)}`,
				}),
		});

		return {
			success: true as const,
			database: {
				status: "up" as const,
				latencyMs: roundMilliseconds(performance.now() - databaseStartedAt),
			},
			totalTimeMs: roundMilliseconds(performance.now() - startedAt),
		};
	});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "health", (handlers) =>
		handlers.handle("healthCheck", healthCheck),
	);
}
