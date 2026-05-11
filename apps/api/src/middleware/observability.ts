import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerError from "effect/unstable/http/HttpServerError";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { Metrics } from "@leuchtturm/api/observability/metrics";
import { Telemetry } from "@leuchtturm/api/observability/telemetry";

export namespace Observability {
	const run = <E, R>(app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const startedAt = yield* Clock.currentTimeMillis;
			const path = Option.getOrElse(
				Option.map(HttpServerRequest.toURL(request), (url) => url.pathname),
				() => request.url,
			);

			const record = (response: HttpServerResponse.HttpServerResponse) =>
				Effect.gen(function* () {
					const durationMs = (yield* Clock.currentTimeMillis) - startedAt;
					const attributes = {
						method: request.method,
						path,
						status: String(response.status),
					};

					yield* Effect.annotateCurrentSpan({
						"http.response.status_code": response.status,
					});

					yield* Effect.all([
						Metrics.increment("api_requests_total", 1, {
							attributes,
							description: "Total number of API requests handled by the worker.",
						}),
						Metrics.observe("api_request_duration_ms", durationMs, {
							attributes,
							boundaries: Metrics.requestDurationBoundaries,
							description: "End-to-end duration of API request handling in milliseconds.",
						}),
					]);
				});

			return yield* app.pipe(
				HttpMiddleware.logger,
				Effect.tap(record),
				Effect.catchCause((cause) =>
					HttpServerError.causeResponse(cause).pipe(
						Effect.tap(([response]) => record(response)),
						Effect.andThen(Effect.failCause(cause)),
					),
				),
				Effect.withSpan(`${request.method} ${path}`, {
					attributes: {
						"http.request.method": request.method,
						"url.path": path,
					},
					kind: "server",
					root: true,
				}),
				Telemetry.withRequest,
			);
		});

	export const middleware = HttpMiddleware.make(run);
}
