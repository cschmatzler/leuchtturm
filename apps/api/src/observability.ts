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
import * as HttpTraceContext from "effect/unstable/http/HttpTraceContext";
import * as Otlp from "effect/unstable/observability/Otlp";
import { Resource } from "sst/resource/cloudflare";

export namespace Observability {
	export interface Interface {
		readonly flush: Effect.Effect<void>;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/api/Observability",
	) {}

	export const requestDurationBoundaries = Metric.exponentialBoundaries({
		start: 0.5,
		factor: 2,
		count: 35,
	});

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
			const request = yield* HttpServerRequest.HttpServerRequest;

			return yield* Effect.useSpan(
				`${request.method} ${Option.getOrElse(
					Option.map(HttpServerRequest.toURL(request), (url) => url.pathname),
					() => request.url,
				)}`,
				{
					attributes: Option.match(HttpServerRequest.toURL(request), {
						onNone: () => ({ "http.request.method": request.method }),
						onSome: (url) => ({
							"http.request.method": request.method,
							"url.full": url.toString(),
							"url.path": url.pathname,
						}),
					}),
					kind: "server",
					parent: Option.getOrUndefined(HttpTraceContext.fromHeaders(request.headers)),
					root: Option.isNone(HttpTraceContext.fromHeaders(request.headers)),
				},
				(span) =>
					Effect.gen(function* () {
						yield* HttpEffect.appendPreResponseHandler((request, response) =>
							Effect.gen(function* () {
								const durationMs = (yield* Clock.currentTimeMillis) - startedAt;
								const metricAttributes = {
									method: request.method,
									path: Option.getOrElse(
										Option.map(HttpServerRequest.toURL(request), (url) => url.pathname),
										() => request.url,
									),
									status: String(response.status),
								};

								span.attribute("http.response.status_code", response.status);

								yield* Effect.all([
									Metric.update(
										Metric.counter("api_requests_total", {
											attributes: metricAttributes,
											description: "Total number of API requests handled by the worker.",
											incremental: true,
										}),
										1,
									),
									Metric.update(
										Metric.histogram("api_request_duration_ms", {
											attributes: metricAttributes,
											boundaries: requestDurationBoundaries,
											description: "End-to-end duration of API request handling in milliseconds.",
										}),
										durationMs,
									),
								]);

								return response;
							}),
						);

						return yield* app.pipe(Effect.withParentSpan(span));
					}),
			);
		}),
	);

	export const layer = Layer.mergeAll(
		Layer.effectContext(
			Effect.gen(function* () {
				const observabilityScope = yield* Scope.make();

				return Context.add(
					yield* Layer.buildWithScope(
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
						observabilityScope,
					),
					Service,
					Service.of({
						flush: Scope.close(observabilityScope, Exit.void),
					}),
				);
			}),
		),
		// The built-in HTTP tracer ends its server span asynchronously, racing our flush.
		Layer.succeed(HttpMiddleware.TracerDisabledWhen, () => true),
	);
}
