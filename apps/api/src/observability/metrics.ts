import * as Metric from "effect/Metric";

export namespace Metrics {
	export const requestCount = Metric.counter("api_requests_total", {
		description: "Total number of API requests handled by the worker.",
		incremental: true,
	});

	export const requestErrorCount = Metric.counter("api_request_errors_total", {
		description: "Total number of API requests that failed or returned a 5xx response.",
		incremental: true,
	});

	export const requestDuration = Metric.histogram("api_request_duration_ms", {
		boundaries: Metric.exponentialBoundaries({ start: 0.5, factor: 2, count: 35 }),
		description: "End-to-end duration of API request handling in milliseconds.",
	});
}
