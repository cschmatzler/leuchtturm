import * as Schema from "effect/Schema";

export class EmailProviderRequestError extends Schema.TaggedErrorClass<EmailProviderRequestError>()(
	"EmailProviderRequestError",
	{ message: Schema.String },
) {
	static new() {
		return new EmailProviderRequestError({ message: "Cloudflare Email request failed." });
	}
}

export class EmailRenderError extends Schema.TaggedErrorClass<EmailRenderError>()(
	"EmailRenderError",
	{
		template: Schema.String,
		message: Schema.String,
	},
) {
	static new(params: { readonly template: string }) {
		return new EmailRenderError({
			...params,
			message: `Failed to render ${params.template} email.`,
		});
	}
}

export const EmailError = Schema.Union([EmailProviderRequestError]);
