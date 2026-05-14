import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as Option from "effect/Option";
import * as Scope from "effect/Scope";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpEffect from "effect/unstable/http/HttpEffect";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as Otlp from "effect/unstable/observability/Otlp";
import { Resource } from "sst/resource/cloudflare";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";

export namespace Observability {
	export const requestDurationBoundaries = Metric.exponentialBoundaries({
		start: 0.5,
		factor: 2,
		count: 35,
	});

	export function withRequestContext(requestContext: Context.Context<RequestContext.Service>) {
		return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			Effect.acquireUseRelease(
				Scope.make(),
				(observabilityScope) =>
					Layer.buildWithScope(layer, observabilityScope).pipe(
						Effect.flatMap((observabilityContext) =>
							effect.pipe(
								Effect.provideContext(Context.merge(requestContext, observabilityContext)),
							),
						),
					),
				(observabilityScope) =>
					Effect.sync(() => {
						Context.get(requestContext, RequestContext.Service).waitUntil(
							Effect.runPromise(Scope.close(observabilityScope, Exit.void)),
						);
					}),
			);
	}

	export function recordAction(action: string, result: "success" | "failure") {
		return Metric.update(
			Metric.counter("api_action_total", {
				attributes: { action, result },
				description: "API actions completed by action name and result.",
				incremental: true,
			}),
			1,
		);
	}

	export const middleware = HttpMiddleware.make((app) =>
		Effect.gen(function* () {
			const startedAt = yield* Clock.currentTimeMillis;

			yield* HttpEffect.appendPreResponseHandler((request, response) =>
				Effect.gen(function* () {
					const durationMs = (yield* Clock.currentTimeMillis) - startedAt;
					const attributes = {
						method: request.method,
						path: Option.getOrElse(
							Option.map(HttpServerRequest.toURL(request), (url) => url.pathname),
							() => request.url,
						),
						status: String(response.status),
					};

					yield* Effect.all([
						Metric.update(
							Metric.counter("api_requests_total", {
								attributes,
								description: "Total number of API requests handled by the worker.",
								incremental: true,
							}),
							1,
						),
						Metric.update(
							Metric.histogram("api_request_duration_ms", {
								attributes,
								boundaries: requestDurationBoundaries,
								description: "End-to-end duration of API request handling in milliseconds.",
							}),
							durationMs,
						),
					]);

					return response;
				}),
			);

			return yield* app;
		}),
	);

	export const layer = Layer.mergeAll(
		Otlp.layerProtobuf({
			baseUrl: Resource.GrafanaOtlpConfig.url,
			headers: { Authorization: Resource.GrafanaOtlpConfig.authorization },
			loggerExcludeLogSpans: false,
			loggerMergeWithExisting: true,
			resource: {
				serviceName: "leuchtturm-api",
				attributes: {
					"service.namespace": "leuchtturm",
					app: "leuchtturm",
					stage: Resource.App.stage,
				},
			},
			shutdownTimeout: "3 seconds",
		}).pipe(Layer.provide(FetchHttpClient.layer)),
		Layer.succeed(
			HttpMiddleware.SpanNameGenerator,
			(request: HttpServerRequest.HttpServerRequest) =>
				`${request.method} ${Option.getOrElse(
					Option.map(HttpServerRequest.toURL(request), (url) => url.pathname),
					() => request.url,
				)}`,
		),
	);
}
