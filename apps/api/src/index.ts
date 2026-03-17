import { Effect, Layer } from "effect";
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

const baseUrl = process.env.BASE_URL;
if (!baseUrl) {
	throw new Error("BASE_URL environment variable is required");
}

/** All handler group implementations. */
const HandlersLive = Layer.mergeAll(
	HealthHandlerLive,
	AnalyticsHandlerLive,
	ErrorsHandlerLive,
	ZeroHandlerLive,
	AuthHandlerLive,
	AutumnHandlerLive,
);

/** CORS middleware applied to all requests. */
const CorsMiddleware = HttpMiddleware.cors({
	allowedOrigins: [baseUrl],
	allowedHeaders: ["Content-Type", "Authorization"],
	allowedMethods: ["GET", "POST", "OPTIONS"],
	exposedHeaders: ["Content-Length"],
	credentials: true,
	maxAge: 600,
});

/**
 * App layer: HttpApi contract + all handler groups + middleware + services.
 *
 * AppLayer provides services (Database, ClickHouse, etc.) to BOTH
 * the handler layers and the HttpApiBuilder layer.
 */
const HandlersWithDeps = HandlersLive.pipe(Layer.provide(AppLayer));

const ApiLive = HttpApiBuilder.layer(ChevrotainApi).pipe(
	Layer.provide(HandlersWithDeps),
	Layer.provide(AuthMiddlewareLive),
);

/**
 * Convert the router-based API layer into a serveable HTTP application effect,
 * then serve it with CORS middleware.
 */
const httpApp = Effect.flatten(HttpRouter.toHttpEffect(ApiLive));

export const ServerLive = HttpServer.serve(httpApp, CorsMiddleware).pipe(
	Layer.provide(HttpServer.layerServices),
	Layer.provide(AppLayer),
);
