import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@chevrotain/api/middleware/auth";
import { AnalyticsPayload, ErrorPayload } from "@chevrotain/core/analytics/schema";
import {
	AuthServiceError,
	DatabaseError,
	RateLimitError,
	UnauthorizedError,
} from "@chevrotain/core/errors";

const SuccessResponse = Schema.Struct({ success: Schema.Literal(true) });
const AuthRouteError = Schema.Union([UnauthorizedError, AuthServiceError]);
const ProtectedRouteError = Schema.Union([DatabaseError, UnauthorizedError, AuthServiceError]);

const healthGroup = HttpApiGroup.make("health").add(
	HttpApiEndpoint.get("healthCheck", "/up", {
		success: SuccessResponse,
	}),
);

const metricsGroup = HttpApiGroup.make("metrics").add(HttpApiEndpoint.get("metrics", "/metrics"));

const analyticsGroup = HttpApiGroup.make("analytics")
	.add(
		HttpApiEndpoint.post("ingestEvents", "/analytics/events", {
			payload: AnalyticsPayload,
			success: SuccessResponse,
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("reportErrors", "/analytics/errors", {
			payload: ErrorPayload,
			success: SuccessResponse,
			error: RateLimitError,
		}),
	);

const zeroGroup = HttpApiGroup.make("zero")
	.add(HttpApiEndpoint.post("query", "/query", { error: ProtectedRouteError }))
	.add(HttpApiEndpoint.post("mutate", "/mutate", { error: ProtectedRouteError }))
	.middleware(AuthMiddleware);

const authGroup = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*", { error: AuthRouteError }))
	.add(HttpApiEndpoint.post("authPost", "/auth/*", { error: AuthRouteError }));

export class ChevrotainWebApi extends HttpApi.make("chevrotain-web")
	.add(analyticsGroup)
	.prefix("/api") {}

export class ChevrotainApi extends HttpApi.make("chevrotain")
	.add(healthGroup, metricsGroup, analyticsGroup, zeroGroup, authGroup)
	.prefix("/api") {}
