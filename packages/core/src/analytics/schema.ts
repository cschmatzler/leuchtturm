import { Schema } from "effect";

import { TrimmedNonEmptyString } from "@chevrotain/core/schema";

export const AnalyticsEvent = Schema.Struct({
	eventType: TrimmedNonEmptyString,
	url: Schema.String,
	referrer: Schema.String,
	properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type AnalyticsEvent = typeof AnalyticsEvent.Type;

export const AnalyticsPayload = Schema.Struct({
	events: Schema.Array(AnalyticsEvent),
});
export type AnalyticsPayload = typeof AnalyticsPayload.Type;

export const ErrorReport = Schema.Struct({
	errorType: Schema.String,
	message: TrimmedNonEmptyString,
	stackTrace: Schema.optional(Schema.String),
	url: Schema.optional(Schema.String),
	properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type ErrorReport = typeof ErrorReport.Type;

export const ErrorPayload = Schema.Struct({
	errors: Schema.Array(ErrorReport),
});
export type ErrorPayload = typeof ErrorPayload.Type;
