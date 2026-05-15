import * as Schema from "effect/Schema";

export class BillingAutumnRequestError extends Schema.TaggedErrorClass<BillingAutumnRequestError>()(
	"BillingAutumnRequestError",
	{
		operation: Schema.String,
		message: Schema.String,
	},
) {
	constructor(params: { readonly operation: string }) {
		super({ ...params, message: `Autumn request failed: ${params.operation}.` });
	}
}

export const BillingError = Schema.Union([BillingAutumnRequestError]);
