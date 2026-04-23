import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@leuchtturm/api/auth";
import { AuthError } from "@leuchtturm/core/auth/errors";
import { DeviceSessionsResponse } from "@leuchtturm/core/auth/schema";
import { BillingError } from "@leuchtturm/core/billing/errors";
import {
	DatabaseError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "@leuchtturm/core/errors";

const HealthCheckSuccessResponse = Schema.Struct({
	success: Schema.Literal(true),
	database: Schema.Struct({
		status: Schema.Literal("up"),
		latencyMs: Schema.Number,
	}),
	totalTimeMs: Schema.Number,
});

const BillingSubscriptionOverview = Schema.Struct({
	currentPeriodEnd: Schema.Date,
	cancelAtPeriodEnd: Schema.Boolean,
});

const BillingOverviewResponse = Schema.Struct({
	activeSubscription: Schema.NullOr(BillingSubscriptionOverview),
});

const BillingUrlResponse = Schema.Struct({
	url: Schema.String,
});

const AuthRouteError = Schema.Union([UnauthorizedError, AuthError]);
const ProtectedRouteError = Schema.Union([DatabaseError, UnauthorizedError, AuthError]);
const BillingRouteError = Schema.Union([
	BillingError,
	UnauthorizedError,
	AuthError,
	ValidationError,
	NotFoundError,
]);

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

export const session = HttpApiGroup.make("session")
	.add(
		HttpApiEndpoint.get("deviceSessions", "/device-sessions", {
			success: DeviceSessionsResponse,
			error: ProtectedRouteError,
		}),
	)
	.middleware(AuthMiddleware.Service);

export const billing = HttpApiGroup.make("billing")
	.add(
		HttpApiEndpoint.get("overview", "/billing/overview", {
			success: BillingOverviewResponse,
			error: BillingRouteError,
		}),
	)
	.add(
		HttpApiEndpoint.post("checkout", "/billing/checkout", {
			success: BillingUrlResponse,
			error: BillingRouteError,
		}),
	)
	.add(
		HttpApiEndpoint.post("portal", "/billing/portal", {
			success: BillingUrlResponse,
			error: BillingRouteError,
		}),
	)
	.middleware(AuthMiddleware.Service);

export const auth = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*", { error: AuthRouteError }))
	.add(HttpApiEndpoint.post("authPost", "/auth/*", { error: AuthRouteError }));

export class LeuchtturmApi extends HttpApi.make("leuchtturm")
	.add(health, zero, session, billing, auth)
	.prefix("/api") {}
