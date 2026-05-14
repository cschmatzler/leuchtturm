import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as OpenApi from "effect/unstable/httpapi/OpenApi";

import { HealthSchema } from "@leuchtturm/api/handlers/health/schema";
import { Session } from "@leuchtturm/api/session";
import { AuthError } from "@leuchtturm/core/auth/errors";
import { DatabaseError } from "@leuchtturm/core/errors";

export namespace Contract {
	export const health = HttpApiGroup.make("health")
		.annotateMerge(
			OpenApi.annotations({
				title: "Health",
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
		.annotateMerge(OpenApi.annotations({ exclude: true }))
		.add(HttpApiEndpoint.post("query", "/query", { error: DatabaseError }))
		.add(HttpApiEndpoint.post("mutate", "/mutate", { error: DatabaseError }))
		.middleware(Session.Middleware);

	export const billing = HttpApiGroup.make("billing")
		.annotateMerge(OpenApi.annotations({ exclude: true }))
		.add(HttpApiEndpoint.get("billingGet", "/api/autumn/*", { error: AuthError }))
		.add(HttpApiEndpoint.post("billingPost", "/api/autumn/*", { error: AuthError }));

	export const auth = HttpApiGroup.make("auth")
		.annotateMerge(
			OpenApi.annotations({
				title: "Auth",
				description:
					"Authentication passthrough; view endpoint details in the [Better Auth API document](/docs?api=auth).",
			}),
		)
		.add(HttpApiEndpoint.get("authGet", "/auth/*", { error: AuthError }))
		.add(HttpApiEndpoint.post("authPost", "/auth/*", { error: AuthError }));

	export const Api = HttpApi.make("leuchtturm")
		.annotateMerge(
			OpenApi.annotations({
				title: "Leuchtturm API",
				description: "HTTP API for Leuchtturm.",
			}),
		)
		.add(health)
		.add(zero)
		.add(billing)
		.add(auth);

	export type Api = typeof Api;
}
