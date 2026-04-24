import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@leuchtturm/api/auth";
import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Auth } from "@leuchtturm/core/auth";
import { Billing } from "@leuchtturm/core/billing";
import { NotFoundError, ValidationError } from "@leuchtturm/core/errors";

export namespace BillingHandler {
	const getActiveOrganization = Effect.fn("billing.activeOrganization")(function* () {
		const { session } = yield* AuthMiddleware.CurrentUser;
		const auth = yield* Auth.Service;
		const request = yield* HttpServerRequest.HttpServerRequest;

		if (!session.activeOrganizationId) {
			return yield* new ValidationError({
				global: [{ message: "No active organization selected" }],
			});
		}

		const activeOrganization = yield* auth.getOrganization(
			new Headers(request.headers as Record<string, string>),
			session.activeOrganizationId,
		);
		if (!activeOrganization) {
			return yield* new NotFoundError({
				resource: "organization",
				message: "Active organization not found",
			});
		}

		return activeOrganization;
	});

	const currentOrigin = Effect.fn("billing.currentOrigin")(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		return new URL((request.source as Request).url).origin;
	});

	const overview = Effect.fn("billing.overview")(function* () {
		const activeOrganization = yield* getActiveOrganization();
		const billing = yield* Billing.Service;
		const state = yield* billing.getCustomerState(activeOrganization.id);
		const activeSubscription = state.activeSubscriptions[0]
			? {
					currentPeriodEnd: state.activeSubscriptions[0].currentPeriodEnd,
					cancelAtPeriodEnd: state.activeSubscriptions[0].cancelAtPeriodEnd,
				}
			: null;

		return { activeSubscription };
	});

	const checkout = Effect.fn("billing.checkout")(function* () {
		const activeOrganization = yield* getActiveOrganization();
		const origin = yield* currentOrigin();
		const billing = yield* Billing.Service;
		const billingUrl = `${origin}/${activeOrganization.slug}/settings/billing`;
		const url = yield* billing.createCheckoutUrl({
			organizationId: activeOrganization.id,
			successUrl: billingUrl,
			returnUrl: billingUrl,
		});

		return { url };
	});

	const portal = Effect.fn("billing.portal")(function* () {
		const activeOrganization = yield* getActiveOrganization();
		const origin = yield* currentOrigin();
		const billing = yield* Billing.Service;
		const url = yield* billing.createPortalUrl({
			organizationId: activeOrganization.id,
			returnUrl: `${origin}/${activeOrganization.slug}/settings/billing`,
		});

		return { url };
	});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "billing", (handlers) =>
		handlers.handle("overview", overview).handle("checkout", checkout).handle("portal", portal),
	);
}
