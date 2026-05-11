import * as Schema from "effect/Schema";

export class EmailProviderRequestError extends Schema.TaggedErrorClass<EmailProviderRequestError>()(
	"EmailProviderRequestError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Cloudflare Email request failed" });
	}
}

export class EmailRenderError extends Schema.TaggedErrorClass<EmailRenderError>()(
	"EmailRenderError",
	{
		template: Schema.String,
		message: Schema.String,
	},
) {
	constructor(params: { readonly template: string }) {
		super({ ...params, message: `Failed to render ${params.template} email` });
	}
}

export const EmailError = Schema.Union([EmailProviderRequestError]);
