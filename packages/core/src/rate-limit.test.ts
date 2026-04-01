import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { RATE_LIMIT_WINDOW_MS, RateLimit } from "@chevrotain/core/rate-limit";

const TEST_RATE_LIMIT_MAX_KEYS = 3;

const runWithRateLimit = <A, E>(
	effect: Effect.Effect<A, E, RateLimit.Service>,
	options?: RateLimit.Options,
) => Effect.runPromise(effect.pipe(Effect.provide(RateLimit.makeLayer(options))));

describe("RateLimit", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date(0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("rejects new unseen keys when the in-memory map is at capacity", async () => {
		const result = await runWithRateLimit(
			Effect.gen(function* () {
				const rateLimit = yield* RateLimit.Service;
				const checkAllowed = (key: string) =>
					rateLimit.check(key).pipe(
						Effect.as(true),
						Effect.catchTag("RateLimitError", () => Effect.succeed(false)),
					);

				for (let i = 0; i < TEST_RATE_LIMIT_MAX_KEYS; i++) {
					yield* rateLimit.check(`key-${i}`);
				}

				const existingKeyAllowed = yield* checkAllowed("key-0");
				const newKeyAllowed = yield* checkAllowed(`key-${TEST_RATE_LIMIT_MAX_KEYS}`);

				return { existingKeyAllowed, newKeyAllowed };
			}),
			{ maxKeys: TEST_RATE_LIMIT_MAX_KEYS },
		);

		expect(result.existingKeyAllowed).toBe(true);
		expect(result.newKeyAllowed).toBe(false);
	});

	it("prunes expired entries during check before admitting a new key", async () => {
		const result = await runWithRateLimit(
			Effect.gen(function* () {
				const rateLimit = yield* RateLimit.Service;

				for (let i = 0; i < TEST_RATE_LIMIT_MAX_KEYS; i++) {
					yield* rateLimit.check(`key-${i}`);
				}

				vi.setSystemTime(new Date(RATE_LIMIT_WINDOW_MS + 1));

				return yield* rateLimit.check(`key-${TEST_RATE_LIMIT_MAX_KEYS}`).pipe(
					Effect.as(true),
					Effect.catchTag("RateLimitError", () => Effect.succeed(false)),
				);
			}),
			{ maxKeys: TEST_RATE_LIMIT_MAX_KEYS },
		);

		expect(result).toBe(true);
	});
});
