import { Effect, Layer, ServiceMap } from "effect";

import { RateLimitError } from "@chevrotain/core/errors";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

export interface RateLimitServiceShape {
	/** Check whether a key is rate-limited. Fails with RateLimitError if the limit is exceeded. */
	readonly check: (key: string, message?: string) => Effect.Effect<void, RateLimitError>;
}

/** In-memory rate limiting service with automatic cleanup of stale entries. */
export class RateLimitService extends ServiceMap.Service<RateLimitService, RateLimitServiceShape>()(
	"RateLimitService",
) {}

/** Layer that provides RateLimitService with a scoped cleanup interval. */
export const RateLimitServiceLive = Layer.effect(RateLimitService)(
	Effect.gen(function* () {
		const requestCounts = new Map<string, { count: number; resetAt: number }>();

		const cleanupInterval = setInterval(() => {
			const now = Date.now();
			for (const [ip, entry] of requestCounts) {
				if (now >= entry.resetAt) {
					requestCounts.delete(ip);
				}
			}
		}, RATE_LIMIT_WINDOW_MS);

		yield* Effect.addFinalizer(() => Effect.sync(() => clearInterval(cleanupInterval)));

		return {
			check: (key: string, message?: string): Effect.Effect<void, RateLimitError> =>
				Effect.gen(function* () {
					const now = Date.now();
					const entry = requestCounts.get(key);

					if (!entry || now >= entry.resetAt) {
						requestCounts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
						return;
					}

					entry.count++;
					if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
						yield* Effect.logWarning("Rate limit exceeded").pipe(
							Effect.annotateLogs("key", key),
							Effect.annotateLogs("count", String(entry.count)),
						);
						return yield* new RateLimitError({ message: message ?? "Too many requests" });
					}
				}),
		};
	}),
);
