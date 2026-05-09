import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import * as Layer from "effect/Layer";
import { Resource } from "sst";

export namespace Metrics {
	const grafanaOtlp = JSON.parse(Resource.GrafanaOtlpUrl.value);
	const metricReader = new PeriodicExportingMetricReader({
		exportIntervalMillis: 30_000,
		exporter: new OTLPMetricExporter({
			headers: {
				Authorization: grafanaOtlp.authorization,
			},
			url: `${grafanaOtlp.url}/v1/metrics`,
		}),
	});
	const meterProvider = new MeterProvider({
		readers: [metricReader],
		resource: resourceFromAttributes({
			"service.name": "leuchtturm-api",
			"service.namespace": "leuchtturm",
			app: "leuchtturm",
			stage: Resource.App.stage,
		}),
	});
	const meter = meterProvider.getMeter("leuchtturm-api");
	const requestCount = meter.createCounter("api_requests_total", {
		description: "Total number of API requests handled by the worker.",
	});
	const requestErrorCount = meter.createCounter("api_request_errors_total", {
		description: "Total number of API requests that failed or returned a 5xx response.",
	});
	const requestDuration = meter.createHistogram("api_request_duration_ms", {
		description: "End-to-end duration of API request handling in milliseconds.",
		unit: "ms",
	});

	export const recordRequest = (attributes: Record<string, string>, durationMs: number) => {
		requestDuration.record(durationMs, attributes);
		requestCount.add(1, attributes);
	};

	export const recordRequestError = (attributes: Record<string, string>) => {
		requestErrorCount.add(1, attributes);
	};

	export const flush = () => meterProvider.forceFlush().catch(() => undefined);

	export const layer = Layer.empty;
}
