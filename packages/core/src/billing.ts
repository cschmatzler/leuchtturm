import { Autumn } from "autumn-js";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Resource } from "sst/resource/cloudflare";

import { BillingAutumnRequestError, BillingError } from "@leuchtturm/core/billing/errors";

export namespace Billing {
	export interface Interface {
		readonly createCustomer: (params: {
			organizationId: string;
			name: string;
			slug: string;
			ownerEmail: string;
			ownerName: string;
		}) => Effect.Effect<void, typeof BillingError.Type>;
		readonly updateCustomer: (params: {
			organizationId: string;
			name: string;
			slug: string;
		}) => Effect.Effect<void, typeof BillingError.Type>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Billing") {}

	export const layer = Layer.effect(Service)(
		Effect.sync(() => {
			const autumn = new Autumn({ secretKey: Resource.AutumnSecretKey.value });

			const createCustomer = Effect.fn("Billing.createCustomer")(
				(params: {
					organizationId: string;
					name: string;
					slug: string;
					ownerEmail: string;
					ownerName: string;
				}) =>
					Effect.tryPromise({
						try: () =>
							autumn.customers.getOrCreate({
								customerId: params.organizationId,
								name: params.name,
								email: params.ownerEmail,
								metadata: {
									slug: params.slug,
									ownerName: params.ownerName,
								},
							}),
						catch: (cause) => cause,
					}).pipe(
						Effect.tapCause((cause) =>
							Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }),
						),
						Effect.mapError(
							() =>
								new BillingAutumnRequestError({
									operation: `Failed to create billing customer for organization ${params.organizationId}`,
								}),
						),
						Effect.asVoid,
					),
			);

			const updateCustomer = Effect.fn("Billing.updateCustomer")(
				(params: { organizationId: string; name: string; slug: string }) =>
					Effect.tryPromise({
						try: () =>
							autumn.customers.update({
								customerId: params.organizationId,
								name: params.name,
								metadata: { slug: params.slug },
							}),
						catch: (cause) => cause,
					}).pipe(
						Effect.tapCause((cause) =>
							Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }),
						),
						Effect.mapError(
							() =>
								new BillingAutumnRequestError({
									operation: `Failed to update billing customer for organization ${params.organizationId}`,
								}),
						),
						Effect.asVoid,
					),
			);

			return Service.of({ createCustomer, updateCustomer });
		}),
	);

	export const defaultLayer = layer;
}
