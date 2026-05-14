import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { Resource } from "sst/resource/cloudflare";

import type { Contract } from "@leuchtturm/api/contract";
import { Metrics } from "@leuchtturm/api/observability/metrics";
import { Auth } from "@leuchtturm/core/auth";
import { Billing } from "@leuchtturm/core/billing";
import { NotFoundError } from "@leuchtturm/core/errors";

export namespace BillingHandler {
	const getOrganization = Effect.fn("billing.organization")(function* (organizationId: string) {
		const auth = yield* Auth.Service;
		const request = yield* HttpServerRequest.HttpServerRequest;

		const organization = yield* auth.getOrganization(
			new Headers(request.headers as Record<string, string>),
			organizationId,
		);
		if (!organization) {
			return yield* new NotFoundError({ resource: "organization" });
		}

		return organization;
	});

	const overview = Effect.fn("billing.overview")(function* ({
		query,
	}: {
		query: { organizationId: string };
	}) {
		const organization = yield* getOrganization(query.organizationId);
		const billing = yield* Billing.Service;
		const state = yield* billing.getCustomerState(organization.id);
		const activeSubscription = state.activeSubscriptions[0]
			? {
					currentPeriodEnd: state.activeSubscriptions[0].currentPeriodEnd,
					cancelAtPeriodEnd: state.activeSubscriptions[0].cancelAtPeriodEnd,
				}
			: null;

		return { activeSubscription };
	});

	const checkout = Effect.fn("billing.checkout")(function* ({
		query,
	}: {
		query: { organizationId: string };
	}) {
		const organization = yield* getOrganization(query.organizationId);
		const billing = yield* Billing.Service;
		const url = yield* billing.createCheckoutUrl({
			organizationId: organization.id,
			successUrl: `https://${Resource.Dns.AppDomain}/${organization.slug}/settings/billing`,
			returnUrl: `https://${Resource.Dns.AppDomain}/${organization.slug}/settings/billing`,
		});

		return { url };
	});

	const portal = Effect.fn("billing.portal")(function* ({
		query,
	}: {
		query: { organizationId: string };
	}) {
		const organization = yield* getOrganization(query.organizationId);
		const billing = yield* Billing.Service;
		const url = yield* billing.createPortalUrl({
			organizationId: organization.id,
			returnUrl: `https://${Resource.Dns.AppDomain}/${organization.slug}/settings/billing`,
		});

		return { url };
	});

	export const layer = (api: Contract.Api) =>
		HttpApiBuilder.group(api, "billing", (handlers) =>
			handlers
				.handle("overview", (request) =>
					overview(request).pipe(
						Effect.tap(() => Metrics.action("billing.overview", "success")),
						Effect.tapCause(() => Metrics.action("billing.overview", "failure")),
					),
				)
				.handle("checkout", (request) =>
					checkout(request).pipe(
						Effect.tap(() => Metrics.action("billing.checkout", "success")),
						Effect.tapCause(() => Metrics.action("billing.checkout", "failure")),
					),
				)
				.handle("portal", (request) =>
					portal(request).pipe(
						Effect.tap(() => Metrics.action("billing.portal", "success")),
						Effect.tapCause(() => Metrics.action("billing.portal", "failure")),
					),
				),
		);
}
