import { Schema } from "effect";

export const GlobalError = Schema.Struct({
	code: Schema.optional(Schema.String),
	message: Schema.String,
});
export type GlobalError = typeof GlobalError.Type;

export const FieldError = Schema.Struct({
	code: Schema.optional(Schema.String),
	message: Schema.String,
	path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
});
export type FieldError = typeof FieldError.Type;

export interface PublicErrorOptions {
	status?: number;
	global?: GlobalError[];
	fields?: FieldError[];
}

export class PublicError extends Error {
	status?: number;
	global: GlobalError[];
	fields: FieldError[];

	constructor(options: PublicErrorOptions) {
		super();
		this.status = options?.status;
		this.global = options.global ?? [];
		this.fields = options.fields ?? [];
	}
}

export const Failure = Schema.Struct({
	success: Schema.Literal(false),
	error: Schema.Struct({
		global: Schema.Array(GlobalError),
		fields: Schema.Array(FieldError),
	}),
});
export type Failure = typeof Failure.Type;
