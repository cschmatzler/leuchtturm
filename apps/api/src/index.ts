import { Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ApiConfig } from "@chevrotain/api/config";
import { ChevrotainApi } from "@chevrotain/api/contract";
import { AnalyticsHandlerLive } from "@chevrotain/api/handlers/analytics";
import { AuthHandlerLive } from "@chevrotain/api/handlers/auth";
import { HealthHandlerLive } from "@chevrotain/api/handlers/health";
import { MetricsHandlerLive } from "@chevrotain/api/handlers/metrics";
import { ZeroHandlerLive } from "@chevrotain/api/handlers/zero";
import { MetricsMiddleware, routeLabelFromUrl } from "@chevrotain/api/metrics";
import { AuthMiddlewareLive } from "@chevrotain/api/middleware/auth-live";
import { ApiErrorReportingMiddleware } from "@chevrotain/api/middleware/error-reporting";
import { RequestContextMiddleware } from "@chevrotain/api/middleware/request-context";
import { AppLayer } from "@chevrotain/api/runtime";

const HandlersLive = Layer.mergeAll(
	HealthHandlerLive,
	MetricsHandlerLive,
	AnalyticsHandlerLive,
	ZeroHandlerLive,
	AuthHandlerLive,
);

const ApiLive = HttpApiBuilder.layer(ChevrotainApi).pipe(
	Layer.provide(HandlersLive),
	Layer.provide(AuthMiddlewareLive),
);

const httpApp = HttpRouter.toHttpEffect(ApiLive).pipe(Effect.flatten);

const HttpTracingLive = Layer.mergeAll(
	HttpMiddleware.layerTracerDisabledForUrls(["/api/metrics"]),
	Layer.succeed(
		HttpMiddleware.SpanNameGenerator,
		(request: { method: string; url: string }) =>
			`${request.method} ${routeLabelFromUrl(request.url)}`,
	),
);

export const ServerLive = Layer.unwrap(
	Effect.gen(function* () {
		const { baseUrl } = yield* ApiConfig;
		const corsMiddleware = HttpMiddleware.cors({
			allowedOrigins: [baseUrl],
			exposedHeaders: ["Content-Length", "X-Request-Id"],
			credentials: true,
			maxAge: 600,
		});
		const appMiddleware = HttpMiddleware.make((app) =>
			corsMiddleware(RequestContextMiddleware(ApiErrorReportingMiddleware(MetricsMiddleware(app)))),
		);
		return HttpServer.serve(httpApp, appMiddleware).pipe(
			Layer.provide(HttpServer.layerServices),
			Layer.provide(HttpTracingLive),
			Layer.provide(AppLayer),
		);
	}),
);
