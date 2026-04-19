import { Metric } from "effect";

import { requestMetricTags, type RequestLike } from "@leuchtturm/api/observability/request";

export const requestCount = Metric.counter("api_requests_total", {
	description: "Total number of API requests handled by the worker.",
});

export const requestErrorCount = Metric.counter("api_request_errors_total", {
	description: "Total number of API requests that failed or returned a 5xx response.",
});

export const requestDuration = Metric.timer("api_request_duration", {
	description: "End-to-end duration of API request handling in milliseconds.",
});

export const tagMetric = <Input, State>(
	metric: Metric.Metric<Input, State>,
	tags: Record<string, string>,
): Metric.Metric<Input, State> => {
	let current = metric;

	for (const [key, value] of Object.entries(tags)) {
		current = Metric.withAttributes(current, { [key]: value });
	}

	return current;
};

export const tagRequestMetric = <Input, State>(
	metric: Metric.Metric<Input, State>,
	request: RequestLike,
	extraTags: Record<string, string> = {},
): Metric.Metric<Input, State> => tagMetric(metric, requestMetricTags(request, extraTags));
