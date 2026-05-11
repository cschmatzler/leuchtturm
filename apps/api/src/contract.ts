import * as Context from "effect/Context";
import * as Schema from "effect/Schema";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";

import { ErrorCatalog, Errors } from "@leuchtturm/api/errors";
import { DeviceSessions, SessionSelect, UserSelect } from "@leuchtturm/core/auth/schema";

export namespace Contract {
	export interface CurrentUser {
		readonly user: typeof UserSelect.Type;
		readonly session: typeof SessionSelect.Type;
	}

	export class CurrentUserContext extends Context.Service<CurrentUserContext, CurrentUser>()(
		"@leuchtturm/api/AuthMiddleware/CurrentUser",
	) {}

	export class AuthMiddleware extends HttpApiMiddleware.Service<
		AuthMiddleware,
		{ provides: CurrentUserContext }
	>()("@leuchtturm/api/AuthMiddleware", { error: Errors }) {}

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
		.middleware(AuthMiddleware);

	export const session = HttpApiGroup.make("session")
		.add(
			HttpApiEndpoint.get("deviceSessions", "/device-sessions", {
				success: DeviceSessions,
			}),
		)
		.middleware(AuthMiddleware);

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
		.middleware(AuthMiddleware);

	export const auth = HttpApiGroup.make("auth")
		.add(HttpApiEndpoint.get("authGet", "/auth/*"))
		.add(HttpApiEndpoint.post("authPost", "/auth/*"));
}

export class LeuchtturmApi extends HttpApi.make("leuchtturm")
	.add(Contract.health, Contract.zero, Contract.session, Contract.billing, Contract.auth)
	.middleware(ErrorCatalog) {}
