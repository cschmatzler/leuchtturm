import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric";
import * as Option from "effect/Option";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerError from "effect/unstable/http/HttpServerError";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import type * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpTraceContext from "effect/unstable/http/HttpTraceContext";
import { Resource } from "sst";

import { Logging } from "@leuchtturm/api/observability/logging";
import { Metrics } from "@leuchtturm/api/observability/metrics";
import {
	requestPath,
	requestSpanAttributes,
	requestSpanName,
	statusGroup,
} from "@leuchtturm/api/observability/request";
import { Tracing } from "@leuchtturm/api/observability/tracing";
import { RequestRuntime } from "@leuchtturm/api/request-runtime";

export namespace ObservabilityMiddleware {
	export const layer = HttpMiddleware.make((app) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const startedAt = Date.now();
			const flushTelemetry = Effect.gen(function* () {
				const metrics = yield* Metrics.Flusher;
				const logging = yield* Logging.Flusher;
				const tracing = yield* Tracing.Flusher;

				yield* RequestRuntime.register(
					Promise.all([metrics.flush(), logging.flush(), tracing.flush()]).then(() => undefined),
				);
			});
			const observe = (
				response: HttpServerResponse.HttpServerResponse,
				cause?: Cause.Cause<unknown>,
			) => {
				const durationMs = Date.now() - startedAt;
				const path = requestPath(request);
				const responseStatusGroup = statusGroup(response.status);
				const requestMetricAttributes = {
					app: "leuchtturm",
					method: request.method,
					route: path,
					stage: Resource.App.stage,
				};
				const logAnnotations = {
					duration_ms: durationMs,
					method: request.method,
					path,
					...(cause ? { request_error: Cause.pretty(cause) } : {}),
					status: response.status,
					status_group: responseStatusGroup,
				};
				const logLevel =
					response.status >= 500 ? "Error" : response.status >= 400 ? "Warn" : "Info";
				const logMessage =
					response.status >= 500
						? "API request failed"
						: response.status >= 400
							? "API request rejected"
							: "API request succeeded";

				return Effect.all([
					Metric.update(
						Metric.withAttributes(Metrics.requestDuration, requestMetricAttributes),
						durationMs,
					),
					Metric.update(
						Metric.withAttributes(Metrics.requestCount, {
							...requestMetricAttributes,
							status_group: responseStatusGroup,
						}),
						1,
					),
					Metric.update(
						Metric.withAttributes(Metrics.requestErrorCount, {
							...requestMetricAttributes,
							error_type: "response",
							status_group: responseStatusGroup,
						}),
						1,
					).pipe(Effect.when(Effect.succeed(response.status >= 500))),
					Effect.annotateCurrentSpan({
						"http.response.status_code": response.status,
						"http.response.status_group": responseStatusGroup,
						"request.duration_ms": durationMs,
						...(cause && response.status >= 500 ? { "request.error": Cause.pretty(cause) } : {}),
					}),
				]).pipe(
					Effect.andThen(
						Effect.logWithLevel(logLevel)(logMessage).pipe(Effect.annotateLogs(logAnnotations)),
					),
					Effect.as(response),
				);
			};

			return yield* app.pipe(
				Effect.tap(observe),
				Effect.catchCause((cause) =>
					HttpServerError.causeResponse(cause).pipe(
						Effect.tap(([response]) => observe(response, cause)),
						Effect.andThen(Effect.failCause(cause)),
					),
				),
				Effect.withSpan(requestSpanName(request), {
					attributes: requestSpanAttributes(request),
					kind: "server",
					parent: Option.getOrUndefined(HttpTraceContext.fromHeaders(request.headers)),
				}),
				Effect.ensuring(flushTelemetry),
			);
		}),
	);
}
