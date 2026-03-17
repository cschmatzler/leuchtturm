import { Autumn } from "autumn-js";
import type { Customer, UpdateCustomerResponse } from "autumn-js";
import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";

import { BillingError } from "@chevrotain/core/errors";

export interface BillingServiceShape {
	readonly getOrCreateCustomer: (params: {
		customerId: string;
		name: string;
		email: string;
	}) => Effect.Effect<Customer, BillingError>;
	readonly updateCustomer: (params: {
		customerId: string;
		name: string;
		email: string;
	}) => Effect.Effect<UpdateCustomerResponse, BillingError>;
}

/** Autumn billing service wrapping the autumn-js client. */
export class BillingService extends ServiceMap.Service<BillingService, BillingServiceShape>()(
	"BillingService",
) {}

/** Layer that provides BillingService. */
export const BillingServiceLive = Layer.effect(BillingService)(
	Effect.gen(function* () {
		const autumnSecretKey = yield* Config.redacted("AUTUMN_SECRET_KEY");
		const autumn = new Autumn({
			secretKey: Redacted.value(autumnSecretKey),
		});

		return {
			getOrCreateCustomer: (params: { customerId: string; name: string; email: string }) =>
				Effect.tryPromise({
					try: () => autumn.customers.getOrCreate(params),
					catch: (cause) =>
						new BillingError({ message: "Failed to get or create customer", cause }),
				}),
			updateCustomer: (params: { customerId: string; name: string; email: string }) =>
				Effect.tryPromise({
					try: () => autumn.customers.update(params),
					catch: (cause) => new BillingError({ message: "Failed to update customer", cause }),
				}),
		};
	}),
);
