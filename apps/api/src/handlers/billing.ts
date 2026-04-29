import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
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

	const currentOrigin = Effect.fn("billing.currentOrigin")(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		return new URL((request.source as Request).url).origin;
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
		const origin = yield* currentOrigin();
		const billing = yield* Billing.Service;
		const billingUrl = `${origin}/${organization.slug}/settings/billing`;
		const url = yield* billing.createCheckoutUrl({
			organizationId: organization.id,
			successUrl: billingUrl,
			returnUrl: billingUrl,
		});

		return { url };
	});

	const portal = Effect.fn("billing.portal")(function* ({
		query,
	}: {
		query: { organizationId: string };
	}) {
		const organization = yield* getOrganization(query.organizationId);
		const origin = yield* currentOrigin();
		const billing = yield* Billing.Service;
		const url = yield* billing.createPortalUrl({
			organizationId: organization.id,
			returnUrl: `${origin}/${organization.slug}/settings/billing`,
		});

		return { url };
	});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "billing", (handlers) =>
		handlers.handle("overview", overview).handle("checkout", checkout).handle("portal", portal),
	);
}
