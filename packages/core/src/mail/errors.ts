import { Schema } from "effect";

export class MailEncryptionError extends Schema.TaggedErrorClass<MailEncryptionError>()(
	"MailEncryptionError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}
