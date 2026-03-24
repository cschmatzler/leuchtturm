import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@chevrotain/api/middleware/auth";
import { AuthServiceError, DatabaseError, UnauthorizedError } from "@chevrotain/core/errors";

const SuccessResponse = Schema.Struct({ success: Schema.Literal(true) });
const AuthRouteError = Schema.Union([UnauthorizedError, AuthServiceError]);
const ProtectedRouteError = Schema.Union([DatabaseError, UnauthorizedError, AuthServiceError]);

const healthGroup = HttpApiGroup.make("health").add(
	HttpApiEndpoint.get("healthCheck", "/up", {
		success: SuccessResponse,
	}),
);

const metricsGroup = HttpApiGroup.make("metrics").add(HttpApiEndpoint.get("metrics", "/metrics"));

const zeroGroup = HttpApiGroup.make("zero")
	.add(HttpApiEndpoint.post("query", "/query", { error: ProtectedRouteError }))
	.add(HttpApiEndpoint.post("mutate", "/mutate", { error: ProtectedRouteError }))
	.middleware(AuthMiddleware);

const authGroup = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*", { error: AuthRouteError }))
	.add(HttpApiEndpoint.post("authPost", "/auth/*", { error: AuthRouteError }));

export class ChevrotainApi extends HttpApi.make("chevrotain")
	.add(healthGroup, metricsGroup, zeroGroup, authGroup)
	.prefix("/api") {}
