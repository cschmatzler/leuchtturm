import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@leuchtturm/api/auth/http-auth";
import { AuthError } from "@leuchtturm/core/auth/errors";
import { DatabaseError, UnauthorizedError } from "@leuchtturm/core/errors";

const HealthCheckSuccessResponse = Schema.Struct({
	success: Schema.Literal(true),
	database: Schema.Struct({
		status: Schema.Literal("up"),
		latencyMs: Schema.Number,
	}),
	totalTimeMs: Schema.Number,
});
const AuthRouteError = Schema.Union([UnauthorizedError, AuthError]);
const ProtectedRouteError = Schema.Union([DatabaseError, UnauthorizedError, AuthError]);

export const health = HttpApiGroup.make("health").add(
	HttpApiEndpoint.get("healthCheck", "/up", {
		success: HealthCheckSuccessResponse,
		error: DatabaseError,
	}),
);

export const zero = HttpApiGroup.make("zero")
	.add(HttpApiEndpoint.post("query", "/query", { error: ProtectedRouteError }))
	.add(HttpApiEndpoint.post("mutate", "/mutate", { error: ProtectedRouteError }))
	.middleware(AuthMiddleware.Service);

export const auth = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*", { error: AuthRouteError }))
	.add(HttpApiEndpoint.post("authPost", "/auth/*", { error: AuthRouteError }));

export class LeuchtturmApi extends HttpApi.make("leuchtturm")
	.add(health, zero, auth)
	.prefix("/api") {}
