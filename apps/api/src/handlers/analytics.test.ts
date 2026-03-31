import { Effect, Layer, Option } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { getReportErrorsRateLimitKey } from "@chevrotain/api/handlers/analytics";
import { Analytics } from "@chevrotain/core/analytics";
import type {
	Error as AnalyticsErrorEvent,
	Event as AnalyticsEvent,
} from "@chevrotain/core/analytics/schema";
import { RATE_LIMIT_MAX_REQUESTS, RateLimit } from "@chevrotain/core/rate-limit";

const mockInsertEvents =
	vi.fn<(events: AnalyticsEvent[], userId: string, sessionId: string) => void>();
const mockInsertErrors = vi.fn<(errors: AnalyticsErrorEvent[]) => void>();

const AnalyticsMock = Layer.succeed(Analytics.Service, {
	insertEvents: (events, userId, sessionId) => {
		mockInsertEvents(events, userId, sessionId);
		return Effect.void;
	},
	insertErrors: (errors) => {
		mockInsertErrors(errors);
		return Effect.void;
	},
});

describe("Analytics integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("provides mock service via Layer", async () => {
		const events: AnalyticsEvent[] = [
			{ eventType: "page_view", url: "https://example.com", referrer: "" },
		];

		const program = Effect.gen(function* () {
			const service = yield* Analytics.Service;
			yield* service.insertEvents(events, "user-1", "session-1");
		});

		await Effect.runPromise(program.pipe(Effect.provide(AnalyticsMock)));

		expect(mockInsertEvents).toHaveBeenCalledWith(events, "user-1", "session-1");
	});

	it("ignores spoofed forwarding headers from untrusted peers", async () => {
		const requests = Array.from({ length: RATE_LIMIT_MAX_REQUESTS + 1 }, (_, index) =>
			HttpServerRequest.fromWeb(
				new Request("http://example.com/api/t/r", {
					headers: {
						"x-forwarded-for": `198.51.100.${index}`,
						"x-real-ip": `203.0.113.${index}`,
					},
				}),
			).modify({ remoteAddress: Option.some("10.0.0.9") }),
		);

		expect(new Set(requests.map(getReportErrorsRateLimitKey))).toEqual(new Set(["10.0.0.9"]));

		const program = Effect.gen(function* () {
			const rateLimit = yield* RateLimit.Service;

			for (const request of requests.slice(0, -1)) {
				yield* rateLimit.check(getReportErrorsRateLimitKey(request), "Too many error reports");
			}

			return yield* rateLimit.check(
				getReportErrorsRateLimitKey(requests[requests.length - 1]!),
				"Too many error reports",
			);
		}).pipe(Effect.provide(RateLimit.defaultLayer));

		await expect(Effect.runPromise(program)).rejects.toMatchObject({
			_tag: "RateLimitError",
			message: "Too many error reports",
		});
	});

	it("uses forwarded client IPs when requests come from the trusted local proxy", async () => {
		const proxiedRequests = [
			HttpServerRequest.fromWeb(
				new Request("http://example.com/api/t/r", {
					headers: {
						"x-forwarded-for": "198.51.100.10, 127.0.0.1",
					},
				}),
			).modify({ remoteAddress: Option.some("127.0.0.1") }),
			HttpServerRequest.fromWeb(
				new Request("http://example.com/api/t/r", {
					headers: {
						"x-forwarded-for": "198.51.100.11, 127.0.0.1",
					},
				}),
			).modify({ remoteAddress: Option.some("127.0.0.1") }),
		];

		expect(proxiedRequests.map(getReportErrorsRateLimitKey)).toEqual([
			"198.51.100.10",
			"198.51.100.11",
		]);

		const program = Effect.gen(function* () {
			const rateLimit = yield* RateLimit.Service;

			for (let index = 0; index < RATE_LIMIT_MAX_REQUESTS; index++) {
				yield* rateLimit.check(
					getReportErrorsRateLimitKey(proxiedRequests[0]!),
					"Too many error reports",
				);
			}

			return yield* rateLimit.check(
				getReportErrorsRateLimitKey(proxiedRequests[1]!),
				"Too many error reports",
			);
		}).pipe(Effect.provide(RateLimit.defaultLayer));

		await expect(Effect.runPromise(program)).resolves.toBeUndefined();
	});
});
