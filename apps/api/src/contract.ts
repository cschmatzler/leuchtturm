import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@leuchtturm/api/auth";
import { ErrorCatalog } from "@leuchtturm/api/errors";
import { DeviceSessions } from "@leuchtturm/core/auth/schema";

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

const BillingOrganizationQuery = Schema.Struct({
	organizationId: Schema.String,
});

export const health = HttpApiGroup.make("health").add(
	HttpApiEndpoint.get("healthCheck", "/up", {
		success: HealthCheckSuccessResponse,
	}),
);

export const zero = HttpApiGroup.make("zero")
	.add(HttpApiEndpoint.post("query", "/query"))
	.add(HttpApiEndpoint.post("mutate", "/mutate"))
	.middleware(AuthMiddleware.Service);

export const session = HttpApiGroup.make("session")
	.add(
		HttpApiEndpoint.get("deviceSessions", "/device-sessions", {
			success: DeviceSessions,
		}),
	)
	.middleware(AuthMiddleware.Service);

export const billing = HttpApiGroup.make("billing")
	.add(
		HttpApiEndpoint.get("overview", "/billing/overview", {
			query: BillingOrganizationQuery,
			success: BillingOverviewResponse,
		}),
	)
	.add(
		HttpApiEndpoint.post("checkout", "/billing/checkout", {
			query: BillingOrganizationQuery,
			success: BillingUrlResponse,
		}),
	)
	.add(
		HttpApiEndpoint.post("portal", "/billing/portal", {
			query: BillingOrganizationQuery,
			success: BillingUrlResponse,
		}),
	)
	.middleware(AuthMiddleware.Service);

export const auth = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*"))
	.add(HttpApiEndpoint.post("authPost", "/auth/*"));

export class LeuchtturmApi extends HttpApi.make("leuchtturm")
	.add(health, zero, session, billing, auth)
	.middleware(ErrorCatalog)
	.prefix("/api") {}
