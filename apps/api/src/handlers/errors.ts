import { Effect, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { RateLimitService } from "@chevrotain/core/rate-limit/service";

export const ErrorsHandlerLive = HttpApiBuilder.group(ChevrotainApi, "errors", (handlers) =>
	handlers.handle(
		"reportErrors",
		Effect.fn("errors.reportErrors")(function* ({ payload }) {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const forwarded = Headers.get(request.headers, "x-forwarded-for").pipe(
				Option.map((v) => v.split(",")[0]?.trim() ?? "unknown"),
			);
			const realIp = Headers.get(request.headers, "x-real-ip");
			const ip = Option.getOrElse(forwarded, () => Option.getOrElse(realIp, () => "unknown"));

			const rateLimit = yield* RateLimitService;
			yield* rateLimit.check(ip, "Too many error reports");

			if (payload.errors.length === 0) {
				return { success: true as const };
			}

			const userAgent = Headers.get(request.headers, "user-agent").pipe(Option.getOrElse(() => ""));

			const analytics = yield* ClickHouseService;
			// Error reporting is best-effort — don't fail the client request if ClickHouse is down.
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
					Effect.catchTag("ClickHouseError", (e) =>
						Effect.logError("Error report insert failed, dropping errors").pipe(
							Effect.annotateLogs("error", e.message),
							Effect.annotateLogs("errorCount", String(payload.errors.length)),
						),
					),
				);

			return { success: true as const };
		}),
	),
);
