import { Schema } from "effect";

import { TrimmedNonEmptyString } from "@chevrotain/core/schema";

export const AnalyticsEvent = Schema.Struct({
	eventType: TrimmedNonEmptyString,
	url: Schema.String,
	referrer: Schema.String,
	properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type AnalyticsEvent = typeof AnalyticsEvent.Type;

export const ErrorEvent = Schema.Struct({
	source: Schema.optional(Schema.Literals(["api", "web"])),
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
	serviceNamespace: Schema.optional(Schema.String),
	serviceName: Schema.optional(Schema.String),
	deploymentEnvironment: Schema.optional(Schema.String),
	properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type ErrorEvent = typeof ErrorEvent.Type;
