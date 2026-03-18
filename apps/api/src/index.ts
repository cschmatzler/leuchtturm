import { Config, Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { AuthHandlerLive } from "@chevrotain/api/handlers/auth";
import { AutumnHandlerLive } from "@chevrotain/api/handlers/autumn";
import { HealthHandlerLive } from "@chevrotain/api/handlers/health";
import { RpcLive } from "@chevrotain/api/handlers/rpc";
import { ZeroHandlerLive } from "@chevrotain/api/handlers/zero";
import { AuthMiddlewareLive } from "@chevrotain/api/middleware/auth";
import { AppLayer } from "@chevrotain/api/runtime";

/** HttpApi handler groups (passthrough endpoints only). */
const HandlersLive = Layer.mergeAll(
	HealthHandlerLive,
	ZeroHandlerLive,
	AuthHandlerLive,
	AutumnHandlerLive,
);

/**
 * HttpApi layer for passthrough endpoints (auth, autumn, zero, health).
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
		const baseUrl = yield* Config.string("BASE_URL");
		const corsMiddleware = HttpMiddleware.cors({
			allowedOrigins: [baseUrl],
			allowedHeaders: ["Content-Type", "Authorization"],
			allowedMethods: ["GET", "POST", "OPTIONS"],
			exposedHeaders: ["Content-Length"],
			credentials: true,
			maxAge: 600,
		});
		return HttpServer.serve(httpApp, corsMiddleware).pipe(
			Layer.provide(HttpServer.layerServices),
			Layer.provide(AppLayer),
		);
	}),
);
