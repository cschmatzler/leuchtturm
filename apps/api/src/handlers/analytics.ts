import { Effect, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { recordDroppedRecords } from "@chevrotain/api/metrics";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { Analytics } from "@chevrotain/core/analytics/index";
import type { AnalyticsPayload, ErrorPayload } from "@chevrotain/core/analytics/schema";
import { RateLimit } from "@chevrotain/core/rate-limit";

export const getReportErrorsRateLimitKey = (request: HttpServerRequest.HttpServerRequest) =>
	Option.getOrElse(request.remoteAddress, () => "unknown");

const handleIngestEvents = Effect.fn("analytics.ingestEvents")(function* ({
	payload,
}: {
	payload: AnalyticsPayload;
}) {
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

	// Best-effort — don't fail the client request if ClickHouse is down.
	yield* analytics.insertEvents([...payload.events], user.id, session.id).pipe(
		Effect.catchTag("ClickHouseError", (error) =>
			Effect.logError("Analytics insert failed, dropping events").pipe(
				Effect.annotateLogs("error", error.message),
				Effect.annotateLogs("eventCount", String(payload.events.length)),
				Effect.tap(() =>
					Effect.sync(() => recordDroppedRecords("analytics_events", payload.events.length)),
				),
			),
		),
	);

	return { success: true as const };
});

const handleReportErrors = Effect.fn("analytics.reportErrors")(function* ({
	payload,
}: {
	payload: ErrorPayload;
}) {
	const analytics = yield* Analytics.Service;
	const rateLimit = yield* RateLimit.Service;

	yield* Effect.annotateCurrentSpan({
		"api.method": "reportErrors",
		"analytics.error_count": payload.errors.length,
	});

	// Rate limit by the trusted peer address reported by the HTTP server.
	const request = yield* HttpServerRequest.HttpServerRequest;
	const ip = getReportErrorsRateLimitKey(request);
	yield* Effect.annotateCurrentSpan("client.address", ip);

	yield* rateLimit.check(ip, "Too many error reports");

	if (payload.errors.length === 0) {
		return { success: true as const };
	}

	const userAgent = Headers.get(request.headers, "user-agent").pipe(Option.getOrElse(() => ""));
	yield* Effect.annotateCurrentSpan("user_agent.original", userAgent);

	// Best-effort — don't fail the client request if ClickHouse is down.
	yield* analytics
		.insertErrors(
			payload.errors.map((error) => ({
				source: "web" as const,
				errorType: error.errorType,
				message: error.message,
				stackTrace: error.stackTrace,
				url: error.url,
				userAgent,
				properties: error.properties,
			})),
		)
		.pipe(
			Effect.catchTag("ClickHouseError", (error) =>
				Effect.logError("Error report insert failed, dropping errors").pipe(
					Effect.annotateLogs("error", error.message),
					Effect.annotateLogs("errorCount", String(payload.errors.length)),
					Effect.tap(() =>
						Effect.sync(() => recordDroppedRecords("error_events", payload.errors.length)),
					),
				),
			),
		);

	return { success: true as const };
});

export const AnalyticsHandlerLive = HttpApiBuilder.group(ChevrotainApi, "analytics", (handlers) =>
	handlers.handle("ingestEvents", handleIngestEvents).handle("reportErrors", handleReportErrors),
);
