import { Effect, Layer } from "effect";

import { registerDatabasePoolMetrics } from "@chevrotain/api/metrics";
import { Analytics } from "@chevrotain/core/analytics/index";
import { Auth } from "@chevrotain/core/auth/index";
import { Database } from "@chevrotain/core/drizzle/index";
import { Email } from "@chevrotain/core/email";
import { RateLimit } from "@chevrotain/core/rate-limit";

const DatabasePoolMetricsLive = Layer.effectDiscard(
	Effect.gen(function* () {
		const { db } = yield* Database.Service;
		yield* Effect.sync(() => registerDatabasePoolMetrics(db.$client));
		yield* Effect.addFinalizer(() => Effect.sync(() => registerDatabasePoolMetrics(undefined)));
	}),
).pipe(Layer.provide(Database.defaultLayer));

export const AppLayer = Layer.mergeAll(
	Database.defaultLayer,
	Analytics.defaultLayer,
	Email.defaultLayer,
	RateLimit.defaultLayer,
	Auth.defaultLayer,
	DatabasePoolMetricsLive,
);
