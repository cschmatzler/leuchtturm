import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerError from "effect/unstable/http/HttpServerError";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import type * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { Metrics } from "@leuchtturm/api/observability/metrics";
import {
	requestPath,
	requestSpanAttributes,
	statusGroup,
} from "@leuchtturm/api/observability/request";
import { RequestRuntime } from "@leuchtturm/api/request-runtime";

export namespace ObservabilityMiddleware {
	export const layer = HttpMiddleware.make((app) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			yield* Effect.annotateCurrentSpan(requestSpanAttributes(request));
			const startedAt = Date.now();
			const exit = yield* Effect.exit(app);
			const durationMs = Date.now() - startedAt;
			let response: HttpServerResponse.HttpServerResponse;
			let errorCause: Cause.Cause<unknown> | undefined;

			if (exit._tag === "Success") {
				response = exit.value;
			} else {
				[response] = yield* HttpServerError.causeResponse(exit.cause);
				errorCause = exit.cause;
				if (response.status >= 500) {
					yield* Effect.annotateCurrentSpan({
						"request.error": Cause.pretty(exit.cause),
					});
				}
			}

			const path = requestPath(request);
			const responseStatusGroup = statusGroup(response.status);
			const requestMetricAttributes = {
				method: request.method,
				route: path,
			};
			Metrics.recordRequest(
				{
					...requestMetricAttributes,
					status_group: responseStatusGroup,
				},
				durationMs,
			);
			yield* Effect.annotateCurrentSpan({
				"http.response.status_code": response.status,
				"http.response.status_group": responseStatusGroup,
				"request.duration_ms": durationMs,
			});
			yield* RequestRuntime.register(Metrics.flush());

			const logAnnotations = {
				duration_ms: durationMs,
				method: request.method,
				path,
				...(errorCause ? { request_error: Cause.pretty(errorCause) } : {}),
				status: response.status,
				status_group: responseStatusGroup,
			};

			if (response.status >= 500) {
				Metrics.recordRequestError({
					...requestMetricAttributes,
					error_type: "response",
					status_group: responseStatusGroup,
				});
				yield* Effect.logError("API request failed").pipe(Effect.annotateLogs(logAnnotations));
			} else if (response.status >= 400) {
				yield* Effect.logWarning("API request rejected").pipe(Effect.annotateLogs(logAnnotations));
			} else {
				yield* Effect.logInfo("API request succeeded").pipe(Effect.annotateLogs(logAnnotations));
			}

			if (exit._tag === "Success") return response;
			return yield* Effect.failCause(exit.cause);
		}),
	);
}
