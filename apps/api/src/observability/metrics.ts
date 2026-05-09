import * as OtelMetrics from "@effect/opentelemetry/Metrics";
import * as OtelResource from "@effect/opentelemetry/Resource";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import { Resource } from "sst";

export namespace Metrics {
	const grafanaOtlp = JSON.parse(Resource.GrafanaOtlpUrl.value);
	export interface FlusherInterface {
		readonly flush: () => Promise<void | undefined>;
	}

	export class Flusher extends Context.Service<Flusher, FlusherInterface>()(
		"@leuchtturm/api/Metrics/Flusher",
	) {}

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
		const metricReader = new PeriodicExportingMetricReader({
			exportIntervalMillis: 30_000,
			exporter: new OTLPMetricExporter({
				headers: {
					Authorization: grafanaOtlp.authorization,
				},
				url: `${grafanaOtlp.url}/v1/metrics`,
			}),
		});

		return Layer.mergeAll(
			OtelMetrics.layer(() => metricReader, { temporality: "cumulative" }).pipe(
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
			Layer.succeed(
				Flusher,
				Flusher.of({
					flush: () => metricReader.forceFlush().catch(() => undefined),
				}),
			),
		);
	});
}
