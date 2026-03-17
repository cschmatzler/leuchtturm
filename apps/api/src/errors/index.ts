import { sValidator } from "@hono/standard-validator";
import { Effect } from "effect";
import { Hono } from "hono";

import { runEffect } from "@one/api/runtime";
import { ErrorPayload } from "@one/core/analytics/schema";
import { ClickHouseService } from "@one/core/analytics/service";
import { RateLimitError, ValidationError } from "@one/core/errors";

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

const app = new Hono().post(
	"/",
	sValidator("json", ErrorPayload, (result) => {
		if (result.success) {
			return;
		}

		throw new ValidationError({
			global: [{ message: "Invalid error payload" }],
		});
	}),
	async (c) => {
		const ip =
			c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
			c.req.header("x-real-ip") ??
			"unknown";

		if (isRateLimited(ip)) {
			throw new RateLimitError({ message: "Too many error reports" });
		}

		const payload = c.req.valid("json");

		if (payload.errors.length === 0) {
			return c.json({ success: true });
		}

		const userAgent = c.req.header("user-agent") ?? "";

		await runEffect(
			Effect.gen(function* () {
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
			}),
		);

		return c.json({ success: true });
	},
);

export default app;
