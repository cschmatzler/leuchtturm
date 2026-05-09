import * as OtelResource from "@effect/opentelemetry/Resource";
import * as OtelTracer from "@effect/opentelemetry/Tracer";
import * as Layer from "effect/Layer";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";

import { requestSpanName } from "@leuchtturm/api/observability/request";

export namespace Tracing {
	export const layer = Layer.mergeAll(
		OtelTracer.layerGlobal.pipe(
			Layer.provide(
				OtelResource.layer({
					serviceName: "leuchtturm-api",
					attributes: {
						"service.namespace": "leuchtturm",
					},
				}),
			),
		),
		Layer.succeed(HttpMiddleware.SpanNameGenerator, requestSpanName),
	);
}
