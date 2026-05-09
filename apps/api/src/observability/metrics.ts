import * as OtelMetrics from "@effect/opentelemetry/Metrics";
import * as OtelResource from "@effect/opentelemetry/Resource";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import { Resource } from "sst";

export namespace Metrics {
	export const requestCount = Metric.counter("api_requests_total", {
		description: "Total number of API requests handled by the worker.",
	});

	export const requestErrorCount = Metric.counter("api_request_errors_total", {
		description: "Total number of API requests that failed or returned a 5xx response.",
	});

	export const requestDuration = Metric.timer("api_request_duration", {
		description: "End-to-end duration of API request handling in milliseconds.",
	});

	export const layer = Layer.suspend(() =>
		OtelMetrics.layer(
			() =>
				new PeriodicExportingMetricReader({
					exportIntervalMillis: 30_000,
					exporter: new OTLPMetricExporter({
						headers: {
							Authorization: `Basic ${btoa(`${(Resource.GrafanaOtlpUrl as unknown as { token: string; username: string }).username}:${(Resource.GrafanaOtlpUrl as unknown as { token: string; username: string }).token}`)}`,
						},
						url: `${Resource.GrafanaOtlpUrl.value}/v1/metrics`,
					}),
				}),
			{ temporality: "cumulative" },
		).pipe(
			Layer.provide(
				OtelResource.layer({
					serviceName: "leuchtturm-api",
					attributes: {
						"service.namespace": "leuchtturm",
						app: "leuchtturm",
						stage: Resource.App.stage,
					},
				}),
			),
		),
	);
}
