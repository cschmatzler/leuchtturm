import { Cause, Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Database } from "@leuchtturm/core/drizzle";
import { DatabaseError } from "@leuchtturm/core/errors";

export namespace HealthHandler {
	export const roundMilliseconds = (durationMs: number) => Math.round(durationMs * 1000) / 1000;

	export const healthCheck = Effect.fn("health.check")(function* () {
		const startedAt = performance.now();
		const { database } = yield* Database.Service;
		const databaseStartedAt = performance.now();

		yield* database.execute("select 1").pipe(
			Effect.catchCause((cause) =>
				Effect.gen(function* () {
					const prettyCause = Cause.pretty(cause);
					yield* Effect.annotateCurrentSpan({ "error.original_cause": prettyCause });
					yield* Effect.logError("Health database check failed").pipe(
						Effect.annotateLogs({ cause: prettyCause }),
					);

					return yield* Effect.fail(
						new DatabaseError({ operation: "Health database check failed" }),
					);
				}),
			),
		);

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
