import { Cause, Effect, Exit, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { isIP } from "node:net";

import { ChevrotainApi } from "@chevrotain/api/contract";
import {
	recordAnalyticsBatch,
	recordAnalyticsInsert,
	recordDroppedRecords,
	recordRateLimitCheck,
} from "@chevrotain/api/metrics";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { Analytics } from "@chevrotain/core/analytics/index";
import { RateLimit } from "@chevrotain/core/rate-limit";

const TRUSTED_PROXY_PEERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function normalizeIpAddress(value: string): string | null {
	const trimmed = value.trim();

	if (trimmed.length === 0) {
		return null;
	}

	if (isIP(trimmed)) {
		return trimmed;
	}

	if (trimmed.startsWith("[") && trimmed.includes("]")) {
		const host = trimmed.slice(1, trimmed.indexOf("]"));
		return isIP(host) ? host : null;
	}

	const lastColonIndex = trimmed.lastIndexOf(":");
	if (lastColonIndex !== -1 && trimmed.indexOf(":") === lastColonIndex) {
		const host = trimmed.slice(0, lastColonIndex);
		return isIP(host) ? host : null;
	}

	return null;
}

function getHeaderValue(request: HttpServerRequest.HttpServerRequest, name: string): string | null {
	return Headers.get(request.headers, name).pipe(
		Option.match({
			onNone: () => null,
			onSome: (value) => value,
		}),
	);
}

function getForwardedClientIp(request: HttpServerRequest.HttpServerRequest): string | null {
	const forwardedFor = getHeaderValue(request, "x-forwarded-for");
	if (forwardedFor) {
		for (const part of forwardedFor.split(",")) {
			const ip = normalizeIpAddress(part);
			if (ip) {
				return ip;
			}
		}
	}

	const realIp = getHeaderValue(request, "x-real-ip");
	return realIp ? normalizeIpAddress(realIp) : null;
}

export const getReportErrorsRateLimitKey = (request: HttpServerRequest.HttpServerRequest) => {
	const peerAddress = Option.getOrElse(request.remoteAddress, () => "unknown");

	if (!TRUSTED_PROXY_PEERS.has(peerAddress)) {
		return peerAddress;
	}

	return getForwardedClientIp(request) ?? peerAddress;
};

const handleIngestEvents = Effect.fn("analytics.ingestEvents")(function* ({ payload }) {
	const analytics = yield* Analytics.Service;

	yield* Effect.annotateCurrentSpan({
		"api.method": "ingestEvents",
		"analytics.event_count": payload.events.length,
	});

	if (payload.events.length === 0) {
		return { success: true as const };
	}

	const { user, session } = yield* CurrentUser;
	yield* Effect.annotateCurrentSpan({
		"enduser.id": user.id,
	});

	const startedAt = performance.now();
	const insertExit = yield* Effect.exit(
		analytics.insertEvents([...payload.events], user.id, session.id),
	);
	const durationSeconds = (performance.now() - startedAt) / 1000;

	if (Exit.isSuccess(insertExit)) {
		recordAnalyticsBatch("events", "ok", payload.events.length);
		recordAnalyticsInsert("analytics_events", "ok", durationSeconds);
		return { success: true as const };
	}

	recordAnalyticsBatch("events", "dropped", payload.events.length);
	recordAnalyticsInsert("analytics_events", "error", durationSeconds);
	const failure = insertExit.cause.reasons.find(Cause.isFailReason);
	yield* Effect.logError("Analytics insert failed, dropping events").pipe(
		Effect.annotateLogs(
			"error",
			failure?.error instanceof Analytics.Error
				? failure.error.message
				: Cause.pretty(insertExit.cause),
		),
		Effect.annotateLogs("eventCount", String(payload.events.length)),
		Effect.tap(() =>
			Effect.sync(() => recordDroppedRecords("analytics_events", payload.events.length)),
		),
	);

	return { success: true as const };
});

const handleReportErrors = Effect.fn("analytics.reportErrors")(function* ({ payload }) {
	const analytics = yield* Analytics.Service;
	const rateLimit = yield* RateLimit.Service;

	yield* Effect.annotateCurrentSpan({
		"api.method": "reportErrors",
		"analytics.error_count": payload.errors.length,
	});

	// Rate limit by the browser client address when the request came through the
	// trusted local reverse proxy, otherwise fall back to the direct peer address.
	const request = yield* HttpServerRequest.HttpServerRequest;
	const ip = getReportErrorsRateLimitKey(request);
	yield* Effect.annotateCurrentSpan("client.address", ip);

	const rateLimitExit = yield* Effect.exit(rateLimit.check(ip, "Too many error reports"));
	if (Exit.isFailure(rateLimitExit)) {
		recordRateLimitCheck("report_errors", "blocked");
		if (payload.errors.length > 0) {
			recordAnalyticsBatch("errors", "rate_limited", payload.errors.length);
		}
		return yield* Effect.failCause(rateLimitExit.cause);
	}

	recordRateLimitCheck("report_errors", "allowed");

	if (payload.errors.length === 0) {
		return { success: true as const };
	}

	const userAgent = Headers.get(request.headers, "user-agent").pipe(Option.getOrElse(() => ""));
	yield* Effect.annotateCurrentSpan("user_agent.original", userAgent);
	const startedAt = performance.now();
	const insertExit = yield* Effect.exit(
		analytics.insertErrors(
			payload.errors.map((error) => ({
				...error,
				source: "web" as const,
				userAgent,
			})),
		),
	);
	const durationSeconds = (performance.now() - startedAt) / 1000;

	if (Exit.isSuccess(insertExit)) {
		recordAnalyticsBatch("errors", "ok", payload.errors.length);
		recordAnalyticsInsert("error_events", "ok", durationSeconds);
		return { success: true as const };
	}

	recordAnalyticsBatch("errors", "dropped", payload.errors.length);
	recordAnalyticsInsert("error_events", "error", durationSeconds);
	const failure = insertExit.cause.reasons.find(Cause.isFailReason);
	yield* Effect.logError("Error event insert failed, dropping errors").pipe(
		Effect.annotateLogs(
			"error",
			failure?.error instanceof Analytics.Error
				? failure.error.message
				: Cause.pretty(insertExit.cause),
		),
		Effect.annotateLogs("errorCount", String(payload.errors.length)),
		Effect.tap(() =>
			Effect.sync(() => recordDroppedRecords("error_events", payload.errors.length)),
		),
	);

	return { success: true as const };
});

export const AnalyticsHandlerLive = HttpApiBuilder.group(ChevrotainApi, "analytics", (handlers) =>
	handlers.handle("ingestEvents", handleIngestEvents).handle("reportErrors", handleReportErrors),
);
