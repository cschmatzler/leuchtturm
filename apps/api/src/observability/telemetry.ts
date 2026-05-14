import * as OtelResource from "@effect/opentelemetry/Resource";
import * as OtelTracer from "@effect/opentelemetry/Tracer";
import { trace, type Span } from "@opentelemetry/api";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as EffectTracer from "effect/Tracer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as Otlp from "effect/unstable/observability/Otlp";
import { Resource } from "sst/resource/cloudflare";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";

export namespace Telemetry {
	export class RootSpan extends Context.Service<RootSpan, Span>()(
		"@leuchtturm/api/observability/Telemetry/RootSpan",
	) {}

	export function withActiveSpan(context: ReturnType<typeof RequestContext.make>) {
		return Effect.sync(() =>
			Option.match(Option.fromNullishOr(trace.getActiveSpan()), {
				onNone: () => context,
				onSome: (activeSpan) =>
					Context.add(
						Context.add(context, RootSpan, activeSpan),
						EffectTracer.ParentSpan,
						OtelTracer.makeExternalSpan(activeSpan.spanContext()),
					),
			}),
		);
	}

	export const layer = Layer.mergeAll(
		OtelTracer.layerGlobal.pipe(
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
		Otlp.layerProtobuf({
			baseUrl: JSON.parse(Resource.GrafanaOtlpConfig.value).url,
			headers: {
				Authorization: JSON.parse(Resource.GrafanaOtlpConfig.value).authorization,
			},
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
