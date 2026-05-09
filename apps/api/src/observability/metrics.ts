import * as OtelMetrics from "@effect/opentelemetry/Metrics";
import * as OtelResource from "@effect/opentelemetry/Resource";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerError from "effect/unstable/http/HttpServerError";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import type * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { Resource } from "sst";

import {
	requestLogAnnotations,
	requestMetricTags,
	requestSpanAttributes,
	statusGroup,
	type RequestLike,
} from "@leuchtturm/api/observability/request";

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
							Authorization: `Bearer ${Resource.GrafanaApiToken.value}`,
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
					},
				}),
			),
		),
	);

	const tagMetric = <Input, State>(
		metric: Metric.Metric<Input, State>,
		tags: Record<string, string>,
	): Metric.Metric<Input, State> => {
		let current = metric;

		for (const [key, value] of Object.entries(tags)) {
			current = Metric.withAttributes(current, { [key]: value });
		}

		return current;
	};

	const tagRequestMetric = <Input, State>(
		metric: Metric.Metric<Input, State>,
		request: RequestLike,
		extraTags: Record<string, string> = {},
	): Metric.Metric<Input, State> => tagMetric(metric, requestMetricTags(request, extraTags));

	const annotateResponse = (status: number, durationMs: number) =>
		Effect.annotateCurrentSpan({
			"http.response.status_code": status,
			"http.response.status_group": statusGroup(status),
			"request.duration_ms": durationMs,
		});

	const recordRequestResponse = (
		request: RequestLike,
		response: HttpServerResponse.HttpServerResponse,
		durationMs: number,
		errorCause?: Cause.Cause<unknown>,
	) =>
		Effect.gen(function* () {
			const prettyCause = errorCause ? Cause.pretty(errorCause) : undefined;
			const annotations = requestLogAnnotations(request, {
				duration_ms: durationMs,
				...(prettyCause ? { request_error: prettyCause } : {}),
				status: response.status,
				status_group: statusGroup(response.status),
			});

			yield* Metric.update(tagRequestMetric(requestDuration, request), Duration.millis(durationMs));
			yield* Metric.update(
				tagRequestMetric(requestCount, request, {
					status_group: statusGroup(response.status),
				}),
				1,
			);
			yield* annotateResponse(response.status, durationMs);

			if (response.status >= 500) {
				yield* Metric.update(
					tagRequestMetric(requestErrorCount, request, {
						error_type: "response",
						status_group: statusGroup(response.status),
					}),
					1,
				);
				yield* Effect.logError("API request failed").pipe(Effect.annotateLogs(annotations));
				return;
			}

			if (response.status >= 400) {
				yield* Effect.logWarning("API request rejected").pipe(Effect.annotateLogs(annotations));
				return;
			}

			yield* Effect.logInfo("API request succeeded").pipe(Effect.annotateLogs(annotations));
		});

	export const Middleware = HttpMiddleware.make((app) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			yield* Effect.annotateCurrentSpan(requestSpanAttributes(request));
			const startedAt = Date.now();
			const exit = yield* Effect.exit(app);
			const durationMs = Date.now() - startedAt;

			if (exit._tag === "Success") {
				yield* recordRequestResponse(request, exit.value, durationMs);
				return exit.value;
			}

			const [response] = yield* HttpServerError.causeResponse(exit.cause);
			if (response.status >= 500) {
				const prettyCause = Cause.pretty(exit.cause);
				yield* Effect.annotateCurrentSpan({
					"request.error": prettyCause,
				});
			}
			yield* recordRequestResponse(request, response, durationMs, exit.cause);
			return yield* Effect.failCause(exit.cause);
		}),
	);
}
