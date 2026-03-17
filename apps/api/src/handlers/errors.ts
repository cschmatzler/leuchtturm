import { Effect, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { RateLimitError } from "@chevrotain/core/errors";

// --- Rate limiting ---

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const entry = requestCounts.get(ip);

	if (!entry || now >= entry.resetAt) {
		requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return false;
	}

	entry.count++;
	return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

/** Periodically clean up stale entries to prevent unbounded memory growth. */
const cleanupInterval = setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of requestCounts) {
		if (now >= entry.resetAt) {
			requestCounts.delete(ip);
		}
	}
}, RATE_LIMIT_WINDOW_MS);

/** Stop the cleanup timer (called during graceful shutdown). */
export function stopRateLimitCleanup(): void {
	clearInterval(cleanupInterval);
}

// --- Handler ---

export const ErrorsHandlerLive = HttpApiBuilder.group(ChevrotainApi, "errors", (handlers) =>
	handlers.handle("reportErrors", ({ payload }) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const forwarded = Headers.get(request.headers, "x-forwarded-for").pipe(
				Option.map((v) => v.split(",")[0]?.trim() ?? "unknown"),
			);
			const realIp = Headers.get(request.headers, "x-real-ip");
			const ip = Option.getOrElse(forwarded, () => Option.getOrElse(realIp, () => "unknown"));

			if (isRateLimited(ip)) {
				return yield* new RateLimitError({ message: "Too many error reports" });
			}

			if (payload.errors.length === 0) {
				return { success: true as const };
			}

			const userAgent = Headers.get(request.headers, "user-agent").pipe(Option.getOrElse(() => ""));

			const analytics = yield* ClickHouseService;
			yield* analytics.insertErrors(
				payload.errors.map((error) => ({
					source: "web" as const,
					errorType: error.errorType,
					message: error.message,
					stackTrace: error.stackTrace,
					url: error.url,
					userAgent,
					properties: error.properties,
				})),
			);

			return { success: true as const };
		}),
	),
);
