import { type Effect, Schema } from "effect";

export interface EmailSendParams {
	readonly from: string;
	readonly to: string;
	readonly subject: string;
	readonly html: string;
	readonly text: string;
}

export type EmailSender<Success, SendError> = (
	params: EmailSendParams,
) => Effect.Effect<Success, SendError>;

export class EmailRenderError extends Schema.TaggedErrorClass<EmailRenderError>()(
	"EmailRenderError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}
