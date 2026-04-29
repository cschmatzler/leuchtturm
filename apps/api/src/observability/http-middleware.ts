import { Cause, Duration, Effect, Metric } from "effect";
import {
	HttpMiddleware,
	HttpServerError,
	HttpServerRequest,
	type HttpServerResponse,
} from "effect/unstable/http";

import {
	requestCount,
	requestDuration,
	requestErrorCount,
	tagRequestMetric,
} from "@leuchtturm/api/observability/metrics";
import {
	requestLogAnnotations,
	requestSpanAttributes,
	statusGroup,
	type RequestLike,
} from "@leuchtturm/api/observability/request";

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
			yield* Effect.logWarning("API request completed").pipe(Effect.annotateLogs(annotations));
			return;
		}

		yield* Effect.logInfo("API request completed").pipe(Effect.annotateLogs(annotations));
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
