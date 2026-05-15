import * as Schema from "effect/Schema";

export class BillingAutumnRequestError extends Schema.TaggedErrorClass<BillingAutumnRequestError>()(
	"BillingAutumnRequestError",
	{
		operation: Schema.String,
		message: Schema.String,
	},
) {
	static new(params: { readonly operation: string }) {
		return new BillingAutumnRequestError({
			...params,
			message: `Autumn request failed: ${params.operation}.`,
		});
	}
}

export const BillingError = Schema.Union([BillingAutumnRequestError]);
