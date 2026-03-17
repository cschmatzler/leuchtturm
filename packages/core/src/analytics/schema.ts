import { type } from "arktype";

export const AnalyticsEvent = type({
	eventType: type("string").pipe((s) => s.trim(), type("string > 0")),
	url: "string",
	referrer: "string",
	"properties?": "Record<string, unknown>",
});
export type AnalyticsEvent = typeof AnalyticsEvent.infer;

export const AnalyticsPayload = type({
	events: AnalyticsEvent.array(),
});
export type AnalyticsPayload = typeof AnalyticsPayload.infer;

export const ErrorReport = type({
	errorType: "string",
	message: type("string").pipe((s) => s.trim(), type("string > 0")),
	"stackTrace?": "string",
	"url?": "string",
	"properties?": "Record<string, unknown>",
});
export type ErrorReport = typeof ErrorReport.infer;

export const ErrorPayload = type({
	errors: ErrorReport.array(),
});
export type ErrorPayload = typeof ErrorPayload.infer;
