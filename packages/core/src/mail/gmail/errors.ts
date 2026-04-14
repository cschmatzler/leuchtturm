import { Schema } from "effect";

export class GmailOAuthError extends Schema.TaggedErrorClass<GmailOAuthError>()(
	"GmailOAuthError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}
