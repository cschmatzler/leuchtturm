import { Schema } from "effect";

export class BillingError extends Schema.TaggedErrorClass<BillingError>()(
	"BillingError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}
