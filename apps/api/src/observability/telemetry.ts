import * as OtelResource from "@effect/opentelemetry/Resource";
import * as OtelTracer from "@effect/opentelemetry/Tracer";
import { trace } from "@opentelemetry/api";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as EffectTracer from "effect/Tracer";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import { Resource } from "sst";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";

export namespace Telemetry {
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
		Layer.succeed(
			HttpMiddleware.SpanNameGenerator,
			(request: HttpServerRequest.HttpServerRequest) =>
				`${request.method} ${Option.getOrElse(
					Option.map(HttpServerRequest.toURL(request), (url) => url.pathname),
					() => request.url,
				)}`,
		),
	);

	export const withActiveSpan = (context: ReturnType<typeof RequestContext.make>) =>
		Effect.sync(() =>
			Option.match(Option.fromNullishOr(trace.getActiveSpan()), {
				onNone: () => context,
				onSome: (activeSpan) =>
					Context.add(
						context,
						EffectTracer.ParentSpan,
						OtelTracer.makeExternalSpan(activeSpan.spanContext()),
					),
			}),
		);
}
