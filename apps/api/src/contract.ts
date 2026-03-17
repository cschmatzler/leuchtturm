import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@chevrotain/api/middleware/auth";
import { ClickHouseError, RateLimitError, ValidationError } from "@chevrotain/core/errors";

// --- Payload schemas (Effect Schema equivalents of the arktype analytics schemas) ---

export const AnalyticsEventSchema = Schema.Struct({
	eventType: Schema.NonEmptyString,
	url: Schema.String,
	referrer: Schema.String,
	properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});

export const AnalyticsPayloadSchema = Schema.Struct({
	events: Schema.Array(AnalyticsEventSchema),
});

export const ErrorReportSchema = Schema.Struct({
	errorType: Schema.String,
	message: Schema.NonEmptyString,
	stackTrace: Schema.optional(Schema.String),
	url: Schema.optional(Schema.String),
	properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});

export const ErrorPayloadSchema = Schema.Struct({
	errors: Schema.Array(ErrorReportSchema),
});

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
			payload: AnalyticsPayloadSchema,
			success: SuccessResponse,
			error: [ValidationError, ClickHouseError],
		}),
	)
	.middleware(AuthMiddleware);

const errorsGroup = HttpApiGroup.make("errors").add(
	HttpApiEndpoint.post("reportErrors", "/errors", {
		payload: ErrorPayloadSchema,
		success: SuccessResponse,
		error: [ValidationError, RateLimitError, ClickHouseError],
	}),
);

const zeroGroup = HttpApiGroup.make("zero")
	.add(HttpApiEndpoint.post("query", "/query"))
	.add(HttpApiEndpoint.post("mutate", "/mutate"))
	.middleware(AuthMiddleware);

const authGroup = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*"))
	.add(HttpApiEndpoint.post("authPost", "/auth/*"));

const autumnGroup = HttpApiGroup.make("autumn")
	.add(HttpApiEndpoint.get("autumnGet", "/autumn/*"))
	.add(HttpApiEndpoint.post("autumnPost", "/autumn/*"))
	.middleware(AuthMiddleware);

// --- Full API ---

export class ChevrotainApi extends HttpApi.make("chevrotain")
	.add(healthGroup, analyticsGroup, errorsGroup, zeroGroup, authGroup, autumnGroup)
	.prefix("/api") {}
