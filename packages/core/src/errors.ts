import * as Schema from "effect/Schema";

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()("ValidationError", {
	fields: Schema.optional(
		Schema.Array(
			Schema.Struct({
				path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
				message: Schema.String,
				code: Schema.optional(Schema.String),
			}),
		),
	),
	global: Schema.optional(
		Schema.Array(
			Schema.Struct({
				message: Schema.String,
				code: Schema.optional(Schema.String),
			}),
		),
	),
}) {}

export class UnauthorizedError extends Schema.TaggedErrorClass<UnauthorizedError>()(
	"UnauthorizedError",
	{ message: Schema.String },
	{ httpApiStatus: 401 },
) {
	static new() {
		return new UnauthorizedError({ message: "Unauthorized." });
	}
}

export class ForbiddenError extends Schema.TaggedErrorClass<ForbiddenError>()("ForbiddenError", {
	message: Schema.String,
}) {
	static new() {
		return new ForbiddenError({ message: "Forbidden." });
	}
}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
	"NotFoundError",
	{
		resource: Schema.String,
		message: Schema.String,
	},
	{ httpApiStatus: 404 },
) {
	static new(params: { readonly resource: string }) {
		return new NotFoundError({ ...params, message: `${params.resource} not found.` });
	}
}

export class DatabaseError extends Schema.TaggedErrorClass<DatabaseError>()("DatabaseError", {
	operation: Schema.String,
	message: Schema.String,
}) {
	static new(params: { readonly operation: string }) {
		return new DatabaseError({ ...params, message: `${params.operation}.` });
	}
}

export class InternalServerError extends Schema.TaggedErrorClass<InternalServerError>()(
	"InternalServerError",
	{ message: Schema.String },
) {
	static new() {
		return new InternalServerError({ message: "API handler failed." });
	}
}

export const Errors = [
	ValidationError,
	UnauthorizedError,
	ForbiddenError,
	NotFoundError,
	DatabaseError,
	InternalServerError,
] as const;
