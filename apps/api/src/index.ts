import { Config, Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { AnalyticsHandlerLive } from "@chevrotain/api/handlers/analytics";
import { AuthHandlerLive } from "@chevrotain/api/handlers/auth";
import { AutumnHandlerLive } from "@chevrotain/api/handlers/autumn";
import { ErrorsHandlerLive } from "@chevrotain/api/handlers/errors";
import { HealthHandlerLive } from "@chevrotain/api/handlers/health";
import { ZeroHandlerLive } from "@chevrotain/api/handlers/zero";
import { AuthMiddlewareLive } from "@chevrotain/api/middleware/auth";
import { AppLayer } from "@chevrotain/api/runtime";

/** All handler group implementations. */
const HandlersLive = Layer.mergeAll(
	HealthHandlerLive,
	AnalyticsHandlerLive,
	ErrorsHandlerLive,
	ZeroHandlerLive,
	AuthHandlerLive,
	AutumnHandlerLive,
);

/**
 * App layer: HttpApi contract + all handler groups + middleware + services.
 *
 * AppLayer is provided once at the outermost point so services are shared
 * across handlers, middleware, and the serve pipeline (no duplicate instances).
 */
const ApiLive = HttpApiBuilder.layer(ChevrotainApi).pipe(
	Layer.provide(HandlersLive),
	Layer.provide(AuthMiddlewareLive),
);

/**
 * Convert the router-based API layer into a serveable HTTP application effect,
 * then serve it with CORS middleware.
 *
 * BASE_URL is read via Effect Config so all configuration flows through the
 * same channel instead of raw process.env reads at module level.
 */
const httpApp = Effect.flatten(HttpRouter.toHttpEffect(ApiLive));

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
