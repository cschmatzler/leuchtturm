import { Effect, Layer, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";

import { ChevrotainRpcs } from "@chevrotain/api/contract-rpc";
import { CurrentUser, RpcAuthMiddlewareLive } from "@chevrotain/api/middleware/auth-live";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { RateLimitService } from "@chevrotain/core/rate-limit/service";

const RpcHandlersLive = ChevrotainRpcs.toLayer(
	Effect.gen(function* () {
		const analytics = yield* ClickHouseService;
		const rateLimit = yield* RateLimitService;

		return ChevrotainRpcs.of({
			IngestEvents: (payload) =>
				Effect.gen(function* () {
					yield* Effect.annotateCurrentSpan({
						"rpc.method": "IngestEvents",
						"rpc.event_count": payload.events.length,
					});

					if (payload.events.length === 0) {
						return { success: true as const };
					}

					const { user, session } = yield* CurrentUser;
					yield* Effect.annotateCurrentSpan({
						"enduser.id": user.id,
					});

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
					yield* Effect.annotateCurrentSpan({
						"rpc.method": "ReportErrors",
						"rpc.error_count": payload.errors.length,
					});

					// Rate limit by IP — extract from forwarded headers.
					const request = yield* HttpServerRequest.HttpServerRequest;
					const forwarded = Headers.get(request.headers, "x-forwarded-for").pipe(
						Option.map((v) => v.split(",")[0]?.trim() ?? "unknown"),
					);
					const realIp = Headers.get(request.headers, "x-real-ip");
					const ip = Option.getOrElse(forwarded, () => Option.getOrElse(realIp, () => "unknown"));
					yield* Effect.annotateCurrentSpan("client.address", ip);

					yield* rateLimit.check(ip, "Too many error reports");

					if (payload.errors.length === 0) {
						return { success: true as const };
					}

					const userAgent = Headers.get(request.headers, "user-agent").pipe(
						Option.getOrElse(() => ""),
					);
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

export const RpcLive = RpcServer.layerHttp({
	group: ChevrotainRpcs,
	path: "/api/rpc",
	protocol: "http",
}).pipe(
	Layer.provide(RpcHandlersLive),
	Layer.provide(RpcAuthMiddlewareLive),
	Layer.provide(RpcSerialization.layerNdjson),
);
