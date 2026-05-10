import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric";
import * as Option from "effect/Option";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerError from "effect/unstable/http/HttpServerError";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { Telemetry } from "@leuchtturm/api/observability/telemetry";

export namespace Observability {
	const requestCount = Metric.counter("api_requests_total", {
		description: "Total number of API requests handled by the worker.",
		incremental: true,
	});

	const requestDuration = Metric.histogram("api_request_duration_ms", {
		boundaries: Metric.exponentialBoundaries({ start: 0.5, factor: 2, count: 35 }),
		description: "End-to-end duration of API request handling in milliseconds.",
	});

	const metrics = HttpMiddleware.make(
		<E, R>(app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const startedAt = yield* Clock.currentTimeMillis;
				const path = Option.getOrElse(
					Option.map(HttpServerRequest.toURL(request), (url) => url.pathname),
					() => request.url,
				);

				const record = (response: HttpServerResponse.HttpServerResponse) =>
					Effect.gen(function* () {
						const finishedAt = yield* Clock.currentTimeMillis;
						const durationMs = finishedAt - startedAt;
						const attributes = {
							method: request.method,
							path,
							status: String(response.status),
						};

						yield* Effect.all([
							Metric.update(Metric.withAttributes(requestCount, attributes), 1),
							Metric.update(Metric.withAttributes(requestDuration, attributes), durationMs),
						]);
					});

				return yield* app.pipe(
					Effect.tap(record),
					Effect.catchCause((cause) =>
						HttpServerError.causeResponse(cause).pipe(
							Effect.tap(([response]) => record(response)),
							Effect.andThen(Effect.failCause(cause)),
						),
					),
				);
			}),
	);

	export const middleware = HttpMiddleware.make((app) =>
		app.pipe(metrics, HttpMiddleware.tracer, HttpMiddleware.logger, Telemetry.withRequest),
	);
}
