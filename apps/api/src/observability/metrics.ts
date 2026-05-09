import * as OtelMetrics from "@effect/opentelemetry/Metrics";
import * as OtelResource from "@effect/opentelemetry/Resource";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";

import { getMetricConfig, makeResourceConfig } from "@leuchtturm/api/observability/config";
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

export const layer = Layer.suspend(() => {
	const config = getMetricConfig();

	return OtelMetrics.layer(
		() =>
			new PeriodicExportingMetricReader({
				exportIntervalMillis: 30_000,
				exporter: new OTLPMetricExporter({
					headers: {
						Authorization: `Bearer ${config.token}`,
					},
					url: config.url,
				}),
			}),
		{ temporality: "cumulative" },
	).pipe(Layer.provide(OtelResource.layer(makeResourceConfig())));
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
