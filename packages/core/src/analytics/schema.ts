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
