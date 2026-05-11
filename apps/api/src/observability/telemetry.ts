import * as OtelResource from "@effect/opentelemetry/Resource";
import * as OtelTracer from "@effect/opentelemetry/Tracer";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import { Resource } from "sst";

export namespace Telemetry {
	const spanName = (request: HttpServerRequest.HttpServerRequest) => {
		const path = Option.getOrElse(
			Option.map(HttpServerRequest.toURL(request), (url) => url.pathname),
			() => request.url,
		);

		return `${request.method} ${path}`;
	};

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
		Layer.succeed(HttpMiddleware.SpanNameGenerator, spanName),
	);
}
