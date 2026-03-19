import { Schema } from "effect";

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
	"NotFoundError",
	{
		resource: Schema.optional(Schema.String),
		message: Schema.optional(Schema.String),
	},
	{ httpApiStatus: 404 },
) {}

export class UnauthorizedError extends Schema.TaggedErrorClass<UnauthorizedError>()(
	"UnauthorizedError",
	{ message: Schema.optional(Schema.String) },
	{ httpApiStatus: 401 },
) {}

export class ForbiddenError extends Schema.TaggedErrorClass<ForbiddenError>()(
	"ForbiddenError",
	{ message: Schema.optional(Schema.String) },
	{ httpApiStatus: 403 },
) {}

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()(
	"ValidationError",
	{
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
	},
	{ httpApiStatus: 400 },
) {}

export class RateLimitError extends Schema.TaggedErrorClass<RateLimitError>()(
	"RateLimitError",
	{ message: Schema.optional(Schema.String) },
	{ httpApiStatus: 429 },
) {}

export class DatabaseError extends Schema.TaggedErrorClass<DatabaseError>()(
	"DatabaseError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class ClickHouseError extends Schema.TaggedErrorClass<ClickHouseError>()(
	"ClickHouseError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class EmailError extends Schema.TaggedErrorClass<EmailError>()(
	"EmailError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class BillingError extends Schema.TaggedErrorClass<BillingError>()(
	"BillingError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}
