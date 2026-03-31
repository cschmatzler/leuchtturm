import { Schema } from "effect";

import { TrimmedNonEmptyString } from "@chevrotain/core/schema";

export const Event = Schema.Struct({
	eventType: TrimmedNonEmptyString,
	url: Schema.String,
	referrer: Schema.String,
	properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type Event = typeof Event.Type;

export const Error = Schema.Struct({
	source: Schema.Literals(["api", "web"]),
	errorType: Schema.String,
	message: TrimmedNonEmptyString,
	userId: Schema.optional(Schema.String),
	sessionId: Schema.optional(Schema.String),
	stackTrace: Schema.optional(Schema.String),
	url: Schema.optional(Schema.String),
	method: Schema.optional(Schema.String),
	statusCode: Schema.optional(Schema.Number),
	userAgent: Schema.optional(Schema.String),
	requestId: Schema.optional(Schema.String),
	traceId: Schema.optional(Schema.String),
	spanId: Schema.optional(Schema.String),
	route: Schema.optional(Schema.String),
	properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type Error = typeof Error.Type;
