import { Autumn } from "autumn-js";
import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";

import { BillingError } from "@one/core/errors";

export interface BillingServiceShape {
	readonly autumn: Autumn;
	readonly getOrCreateCustomer: (params: {
		customerId: string;
		name: string;
		email: string;
	}) => Effect.Effect<unknown, BillingError>;
	readonly updateCustomer: (params: {
		customerId: string;
		name: string;
		email: string;
	}) => Effect.Effect<unknown, BillingError>;
}

/** Autumn billing service wrapping the autumn-js client. */
export class BillingService extends ServiceMap.Service<
	BillingService,
	BillingServiceShape
>()("BillingService") {}

/** Layer that provides BillingService. */
export const BillingServiceLive = Layer.effect(BillingService)(
	Effect.gen(function* () {
		const autumnSecretKey = yield* Config.redacted("AUTUMN_SECRET_KEY");
		const autumn = new Autumn({
			secretKey: Redacted.value(autumnSecretKey),
		});

		return {
			autumn,
			getOrCreateCustomer: (params: { customerId: string; name: string; email: string }) =>
				Effect.tryPromise({
					try: () => autumn.customers.getOrCreate(params),
					catch: (cause) => new BillingError({ cause }),
				}),
			updateCustomer: (params: { customerId: string; name: string; email: string }) =>
				Effect.tryPromise({
					try: () => autumn.customers.update(params),
					catch: (cause) => new BillingError({ cause }),
				}),
		};
	}),
);
