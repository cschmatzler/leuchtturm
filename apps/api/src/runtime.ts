import { Cause, Effect, Exit, Layer, ManagedRuntime, Result } from "effect";

import { ClickHouseServiceLive } from "@one/core/analytics/service";
import { BillingServiceLive } from "@one/core/billing/service";
import { DatabaseServiceLive } from "@one/core/drizzle/service";
import { EmailServiceLive } from "@one/core/email/service";

/** All service layers composed into the application layer. */
export const AppLayer = Layer.mergeAll(
	DatabaseServiceLive,
	ClickHouseServiceLive,
	BillingServiceLive,
	EmailServiceLive,
);

/** Managed runtime — created once, lives for the app's lifetime. */
const AppRuntime = ManagedRuntime.make(AppLayer);

/**
 * Run an Effect inside a Hono handler.
 * This is the ONLY place effects should be executed — compose with yield* everywhere else.
 */
export const runEffect = <A, E>(
	effect: Effect.Effect<A, E, Layer.Success<typeof AppLayer>>,
): Promise<A> =>
	AppRuntime.runPromiseExit(effect).then((exit) => {
		if (Exit.isFailure(exit)) {
			// Re-throw defects (bugs) as regular errors for Hono's .onError
			const defectResult = Cause.findDefect(exit.cause);
			if (Result.isSuccess(defectResult)) {
				throw defectResult.success;
			}
			// Re-throw typed failures — Hono's .onError will catch TaggedErrors
			const errorResult = Cause.findError(exit.cause);
			if (Result.isSuccess(errorResult)) {
				throw errorResult.success;
			}
			throw exit;
		}
		return exit.value;
	});

/**
 * Run an Effect as fire-and-forget from non-Effect contexts (e.g. Hono .onError).
 * Logs failures to stderr since the caller can't handle them.
 */
export const runEffectFork = <E>(
	effect: Effect.Effect<void, E, Layer.Success<typeof AppLayer>>,
): void => {
	AppRuntime.runPromise(effect).catch((error) => {
		console.error("Background effect failed:", error);
	});
};

/**
 * Shutdown the runtime (called on SIGINT/SIGTERM).
 * Closes all managed resources (DB pool, ClickHouse client, etc).
 */
export const shutdownRuntime = () => AppRuntime.dispose();
