import * as Schema from "effect/Schema";

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
