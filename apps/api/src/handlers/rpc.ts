import { Effect, Layer, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";

import { ChevrotainRpcs } from "@chevrotain/api/contract-rpc";
import { CurrentUser, RpcAuthMiddlewareLive } from "@chevrotain/api/middleware/auth";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { RateLimitService } from "@chevrotain/core/rate-limit/service";

/** RPC handler implementations for IngestEvents, ReportErrors, and HealthCheck. */
const RpcHandlersLive = ChevrotainRpcs.toLayer(
	Effect.gen(function* () {
		const analytics = yield* ClickHouseService;
		const rateLimit = yield* RateLimitService;

		return ChevrotainRpcs.of({
			IngestEvents: (payload) =>
				Effect.gen(function* () {
					if (payload.events.length === 0) {
						return { success: true as const };
					}

					const { user, session } = yield* CurrentUser;

					// Best-effort — don't fail the client request if ClickHouse is down.
					yield* analytics
						.insertEvents([...payload.events], user.id, session.id)
						.pipe(
							Effect.catchTag("ClickHouseError", (e) =>
								Effect.logError("Analytics insert failed, dropping events").pipe(
									Effect.annotateLogs("error", e.message),
									Effect.annotateLogs("eventCount", String(payload.events.length)),
								),
							),
						);

					return { success: true as const };
				}),

			ReportErrors: (payload) =>
				Effect.gen(function* () {
					// Rate limit by IP — extract from forwarded headers.
					const request = yield* HttpServerRequest.HttpServerRequest;
					const forwarded = Headers.get(request.headers, "x-forwarded-for").pipe(
						Option.map((v) => v.split(",")[0]?.trim() ?? "unknown"),
					);
					const realIp = Headers.get(request.headers, "x-real-ip");
					const ip = Option.getOrElse(forwarded, () => Option.getOrElse(realIp, () => "unknown"));

					yield* rateLimit.check(ip, "Too many error reports");

					if (payload.errors.length === 0) {
						return { success: true as const };
					}

					const userAgent = Headers.get(request.headers, "user-agent").pipe(
						Option.getOrElse(() => ""),
					);

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
							Effect.catchTag("ClickHouseError", (e) =>
								Effect.logError("Error report insert failed, dropping errors").pipe(
									Effect.annotateLogs("error", e.message),
									Effect.annotateLogs("errorCount", String(payload.errors.length)),
								),
							),
						);

					return { success: true as const };
				}),

			HealthCheck: () => Effect.succeed({ success: true as const }),
		});
	}),
);

/**
 * RPC server layer — registers a POST route at /api/rpc on the HttpRouter.
 *
 * Uses HTTP protocol (not WebSocket) with NDJSON serialization.
 */
export const RpcLive = RpcServer.layerHttp({
	group: ChevrotainRpcs,
	path: "/api/rpc",
	protocol: "http",
}).pipe(
	Layer.provide(RpcHandlersLive),
	Layer.provide(RpcAuthMiddlewareLive),
	Layer.provide(RpcSerialization.layerNdjson),
);
