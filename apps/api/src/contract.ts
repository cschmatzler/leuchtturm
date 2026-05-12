import * as Schema from "effect/Schema";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as OpenApi from "effect/unstable/httpapi/OpenApi";

import { BillingSchema } from "@leuchtturm/api/handlers/billing/schema";
import { HealthSchema } from "@leuchtturm/api/handlers/health/schema";
import { Session } from "@leuchtturm/api/session";
import { AuthError } from "@leuchtturm/core/auth/errors";
import { DeviceSessions } from "@leuchtturm/core/auth/schema";
import { BillingError } from "@leuchtturm/core/billing/errors";
import { DatabaseError, NotFoundError } from "@leuchtturm/core/errors";

export namespace Contract {
	export const health = HttpApiGroup.make("health")
		.annotateMerge(
			OpenApi.annotations({
				description: "Operational health checks for the API and its dependencies.",
			}),
		)
		.add(
			HttpApiEndpoint.get("healthCheck", "/up", {
				success: HealthSchema.SuccessResponse,
				error: DatabaseError,
			}).annotateMerge(
				OpenApi.annotations({
					summary: "Check API health",
					description:
						"Checks whether the API is reachable and verifies database connectivity. Returns dependency status and request timing information.",
				}),
			),
		);

	export const zero = HttpApiGroup.make("zero")
		.annotateMerge(
			OpenApi.annotations({
				description: "Zero sync endpoints used by the client for reads and writes.",
			}),
		)
		.add(
			HttpApiEndpoint.post("query", "/query", { error: DatabaseError }).annotateMerge(
				OpenApi.annotations({
					summary: "Run a Zero query",
					description:
						"Executes a Zero query request for the authenticated user. The request and response bodies follow Zero's query protocol.",
				}),
			),
		)
		.add(
			HttpApiEndpoint.post("mutate", "/mutate", { error: DatabaseError }).annotateMerge(
				OpenApi.annotations({
					summary: "Run a Zero mutation",
					description:
						"Executes a Zero mutation request for the authenticated user. The request and response bodies follow Zero's mutation protocol.",
				}),
			),
		)
		.middleware(Session.Middleware);

	export const session = HttpApiGroup.make("session")
		.annotateMerge(
			OpenApi.annotations({
				description: "Session and device management for the authenticated user.",
			}),
		)
		.add(
			HttpApiEndpoint.get("deviceSessions", "/device-sessions", {
				success: DeviceSessions,
				error: AuthError,
			}).annotateMerge(
				OpenApi.annotations({
					summary: "List device sessions",
					description: "Returns the active device sessions associated with the authenticated user.",
				}),
			),
		)
		.middleware(Session.Middleware);

	export const billing = HttpApiGroup.make("billing")
		.annotateMerge(
			OpenApi.annotations({
				description: "Billing, checkout, and customer portal endpoints for organizations.",
			}),
		)
		.add(
			HttpApiEndpoint.get("overview", "/billing/overview", {
				query: BillingSchema.OrganizationQuery,
				success: BillingSchema.OverviewResponse,
				error: [AuthError, BillingError, NotFoundError],
			}).annotateMerge(
				OpenApi.annotations({
					summary: "Get billing overview",
					description:
						"Returns the billing state for an organization, including the current active subscription when one exists.",
				}),
			),
		)
		.add(
			HttpApiEndpoint.post("checkout", "/billing/checkout", {
				query: BillingSchema.OrganizationQuery,
				success: Schema.Struct({ url: Schema.String }),
				error: [AuthError, BillingError, NotFoundError],
			}).annotateMerge(
				OpenApi.annotations({
					summary: "Create checkout session",
					description:
						"Creates a hosted checkout URL for an organization so the user can start or change a subscription.",
				}),
			),
		)
		.add(
			HttpApiEndpoint.post("portal", "/billing/portal", {
				query: BillingSchema.OrganizationQuery,
				success: Schema.Struct({ url: Schema.String }),
				error: [AuthError, BillingError, NotFoundError],
			}).annotateMerge(
				OpenApi.annotations({
					summary: "Create billing portal session",
					description:
						"Creates a hosted customer portal URL for an organization so the user can manage billing details and subscriptions.",
				}),
			),
		)
		.middleware(Session.Middleware);

	export const auth = HttpApiGroup.make("auth")
		.annotateMerge(
			OpenApi.annotations({
				description: "Authentication passthrough endpoints handled by the auth service.",
			}),
		)
		.add(
			HttpApiEndpoint.get("authGet", "/auth/*", { error: AuthError }).annotateMerge(
				OpenApi.annotations({
					summary: "Handle auth GET request",
					description:
						"Forwards GET requests under /auth to the auth service for authentication flows such as callbacks and session lookups.",
				}),
			),
		)
		.add(
			HttpApiEndpoint.post("authPost", "/auth/*", { error: AuthError }).annotateMerge(
				OpenApi.annotations({
					summary: "Handle auth POST request",
					description:
						"Forwards POST requests under /auth to the auth service for authentication actions such as sign-in and sign-out.",
				}),
			),
		);

	export class LeuchtturmApi extends HttpApi.make("leuchtturm")
		.annotateMerge(
			OpenApi.annotations({
				title: "Leuchtturm API",
				description: "HTTP API for Leuchtturm.",
			}),
		)
		.add(health)
		.add(zero)
		.add(session)
		.add(billing)
		.add(auth) {}
}

export type LeuchtturmApi = typeof Contract.LeuchtturmApi;
export const LeuchtturmApi = Contract.LeuchtturmApi;
