import { Effect, Layer, ServiceMap } from "effect";

import { RateLimitError } from "@chevrotain/core/errors";

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 30;
export const RATE_LIMIT_MAX_KEYS = 10_000;

export namespace RateLimit {
	export interface Interface {
		/** Check whether a key is rate-limited. Fails with RateLimitError if the limit is exceeded. */
		readonly check: (key: string, message?: string) => Effect.Effect<void, RateLimitError>;
	}

	/** In-memory rate limiting service with automatic cleanup of stale entries. */
	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/RateLimit") {}

	/** Layer that provides RateLimit with a scoped cleanup interval. */
	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const requestCounts = new Map<string, { count: number; resetAt: number }>();

			const pruneExpiredEntries = (now: number) => {
				for (const [key, entry] of requestCounts) {
					if (now >= entry.resetAt) {
						requestCounts.delete(key);
					}
				}
			};

			const cleanupInterval = setInterval(() => {
				pruneExpiredEntries(Date.now());
			}, RATE_LIMIT_WINDOW_MS);

			yield* Effect.addFinalizer(() => Effect.sync(() => clearInterval(cleanupInterval)));

			const check = Effect.fn("RateLimit.check")(function* (key: string, message?: string) {
				const now = Date.now();
				const entry = requestCounts.get(key);

				if (!entry) {
					pruneExpiredEntries(now);

					if (requestCounts.size >= RATE_LIMIT_MAX_KEYS) {
						yield* Effect.logWarning("Rate limit key capacity exceeded").pipe(
							Effect.annotateLogs("key", key),
							Effect.annotateLogs("maxKeys", String(RATE_LIMIT_MAX_KEYS)),
						);
						return yield* new RateLimitError({ message: message ?? "Too many requests" });
					}

					requestCounts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
					return;
				}

				if (now >= entry.resetAt) {
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
			});

			return Service.of({ check });
		}),
	);

	export const defaultLayer = layer;
}
