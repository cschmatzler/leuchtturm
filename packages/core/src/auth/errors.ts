import { Schema } from "effect";

export class AuthError extends Schema.TaggedErrorClass<AuthError>()(
	"AuthError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}
