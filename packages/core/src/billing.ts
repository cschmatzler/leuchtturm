import { Autumn } from "autumn-js";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Resource } from "sst/resource/cloudflare";

import { BillingAutumnRequestError, BillingError } from "@leuchtturm/core/billing/errors";

const autumnClient = new Autumn({
	secretKey: Resource.AutumnSecretKey.value,
});

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

	const createCustomer = Effect.fn("Billing.createCustomer")(function* (params: {
		organizationId: string;
		name: string;
		slug: string;
		ownerEmail: string;
		ownerName: string;
	}) {
		const result = yield* Effect.tryPromise({
			try: () =>
				autumnClient.customers.create({
					id: params.organizationId,
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
		);

		if (result.error) {
			return yield* new BillingAutumnRequestError({
				operation: `Failed to create billing customer for organization ${params.organizationId}`,
			});
		}
	});

	const updateCustomer = Effect.fn("Billing.updateCustomer")(function* (params: {
		organizationId: string;
		name: string;
		slug: string;
	}) {
		const result = yield* Effect.tryPromise({
			try: () =>
				autumnClient.customers.update(params.organizationId, {
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
		);

		if (result.error) {
			return yield* new BillingAutumnRequestError({
				operation: `Failed to update billing customer for organization ${params.organizationId}`,
			});
		}
	});

	export const layer = Layer.effect(Service)(
		Effect.succeed(Service.of({ createCustomer, updateCustomer })),
	);

	export const defaultLayer = layer;
}
