import { Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ApiBaseUrlConfig } from "@chevrotain/api/config";
import { ChevrotainApi } from "@chevrotain/api/contract";
import { AuthHandlerLive } from "@chevrotain/api/handlers/auth";
import { HealthHandlerLive } from "@chevrotain/api/handlers/health";
import { MetricsHandlerLive } from "@chevrotain/api/handlers/metrics";
import { RpcLive } from "@chevrotain/api/handlers/rpc";
import { ZeroHandlerLive } from "@chevrotain/api/handlers/zero";
import { MetricsMiddleware } from "@chevrotain/api/metrics";
import { AuthMiddlewareLive } from "@chevrotain/api/middleware/auth-live";
import { AppLayer } from "@chevrotain/api/runtime";

/** HttpApi handler groups (passthrough endpoints only). */
const HandlersLive = Layer.mergeAll(
	HealthHandlerLive,
	MetricsHandlerLive,
	ZeroHandlerLive,
	AuthHandlerLive,
);

/**
 * HttpApi layer for passthrough endpoints (auth, zero, health).
 * Analytics and errors are now served via RPC.
 */
const ApiLive = HttpApiBuilder.layer(ChevrotainApi).pipe(
	Layer.provide(HandlersLive),
	Layer.provide(AuthMiddlewareLive),
);

/**
 * Combined layer: HttpApi routes + RPC routes on the same HttpRouter.
 *
 * RpcLive registers POST /api/rpc on the router. ApiLive registers the
 * remaining HttpApi routes. Both share the same HttpRouter instance.
 */
const RoutesLive = Layer.mergeAll(ApiLive, RpcLive);

/**
 * Convert the router into a serveable HTTP application and add CORS.
 */
const httpApp = Effect.flatten(HttpRouter.toHttpEffect(RoutesLive));

export const ServerLive = Layer.unwrap(
	Effect.gen(function* () {
		const baseUrl = yield* ApiBaseUrlConfig;
		const corsMiddleware = HttpMiddleware.cors({
			allowedOrigins: [baseUrl],
			exposedHeaders: ["Content-Length"],
			credentials: true,
			maxAge: 600,
		});
		const appMiddleware = HttpMiddleware.make((app) => corsMiddleware(MetricsMiddleware(app)));
		return HttpServer.serve(httpApp, appMiddleware).pipe(
			Layer.provide(HttpServer.layerServices),
			Layer.provide(AppLayer),
		);
	}),
);
