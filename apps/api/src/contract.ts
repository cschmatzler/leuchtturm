import * as Schema from "effect/Schema";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { BillingHandler } from "@leuchtturm/api/handlers/billing-handler";
import { HealthHandler } from "@leuchtturm/api/handlers/health-handler";
import { Session } from "@leuchtturm/api/session";
import { AuthError } from "@leuchtturm/core/auth/errors";
import { DeviceSessions } from "@leuchtturm/core/auth/schema";
import { BillingError } from "@leuchtturm/core/billing/errors";
import { DatabaseError, NotFoundError } from "@leuchtturm/core/errors";

export namespace Contract {
	const BillingOrganizationQuery = Schema.Struct({
		organizationId: Schema.String,
	});

	export const health = HttpApiGroup.make("health").add(
		HttpApiEndpoint.get("healthCheck", "/up", {
			success: HealthHandler.SuccessResponse,
			error: DatabaseError,
		}),
	);

	export const zero = HttpApiGroup.make("zero")
		.add(HttpApiEndpoint.post("query", "/query", { error: DatabaseError }))
		.add(HttpApiEndpoint.post("mutate", "/mutate", { error: DatabaseError }))
		.middleware(Session.Middleware);

	export const session = HttpApiGroup.make("session")
		.add(
			HttpApiEndpoint.get("deviceSessions", "/device-sessions", {
				success: DeviceSessions,
				error: AuthError,
			}),
		)
		.middleware(Session.Middleware);

	export const billing = HttpApiGroup.make("billing")
		.add(
			HttpApiEndpoint.get("overview", "/billing/overview", {
				query: BillingOrganizationQuery,
				success: BillingHandler.OverviewResponse,
				error: [AuthError, BillingError, NotFoundError],
			}),
		)
		.add(
			HttpApiEndpoint.post("checkout", "/billing/checkout", {
				query: BillingOrganizationQuery,
				success: BillingHandler.UrlResponse,
				error: [AuthError, BillingError, NotFoundError],
			}),
		)
		.add(
			HttpApiEndpoint.post("portal", "/billing/portal", {
				query: BillingOrganizationQuery,
				success: BillingHandler.UrlResponse,
				error: [AuthError, BillingError, NotFoundError],
			}),
		)
		.middleware(Session.Middleware);

	export const auth = HttpApiGroup.make("auth")
		.add(HttpApiEndpoint.get("authGet", "/auth/*", { error: AuthError }))
		.add(HttpApiEndpoint.post("authPost", "/auth/*", { error: AuthError }));

	export class LeuchtturmApi extends HttpApi.make("leuchtturm").add(
		health,
		zero,
		session,
		billing,
		auth,
	) {}
}

export type LeuchtturmApi = typeof Contract.LeuchtturmApi;
export const LeuchtturmApi = Contract.LeuchtturmApi;
