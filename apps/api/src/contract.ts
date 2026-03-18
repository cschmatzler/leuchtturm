import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@chevrotain/api/middleware/auth";
import { AnalyticsPayload, ErrorPayload } from "@chevrotain/core/analytics/schema";
import {
	BillingError,
	ClickHouseError,
	DatabaseError,
	RateLimitError,
	UnauthorizedError,
	ValidationError,
} from "@chevrotain/core/errors";

const SuccessResponse = Schema.Struct({ success: Schema.Literal(true) });

// --- Endpoint groups ---

const healthGroup = HttpApiGroup.make("health").add(
	HttpApiEndpoint.get("healthCheck", "/up", {
		success: SuccessResponse,
	}),
);

const analyticsGroup = HttpApiGroup.make("analytics")
	.add(
		HttpApiEndpoint.post("ingestEvents", "/analytics", {
			payload: AnalyticsPayload,
			success: SuccessResponse,
			error: [ValidationError, ClickHouseError],
		}),
	)
	.middleware(AuthMiddleware);

const errorsGroup = HttpApiGroup.make("errors").add(
	HttpApiEndpoint.post("reportErrors", "/errors", {
		payload: ErrorPayload,
		success: SuccessResponse,
		error: [ValidationError, RateLimitError, ClickHouseError],
	}),
);

const zeroGroup = HttpApiGroup.make("zero")
	.add(HttpApiEndpoint.post("query", "/query", { error: DatabaseError }))
	.add(HttpApiEndpoint.post("mutate", "/mutate", { error: DatabaseError }))
	.middleware(AuthMiddleware);

const authGroup = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*", { error: UnauthorizedError }))
	.add(HttpApiEndpoint.post("authPost", "/auth/*", { error: UnauthorizedError }));

const autumnGroup = HttpApiGroup.make("autumn")
	.add(HttpApiEndpoint.get("autumnGet", "/autumn/*", { error: [BillingError, ValidationError] }))
	.add(HttpApiEndpoint.post("autumnPost", "/autumn/*", { error: [BillingError, ValidationError] }))
	.middleware(AuthMiddleware);

// --- Full API ---

export class ChevrotainApi extends HttpApi.make("chevrotain")
	.add(healthGroup, analyticsGroup, errorsGroup, zeroGroup, authGroup, autumnGroup)
	.prefix("/api") {}
