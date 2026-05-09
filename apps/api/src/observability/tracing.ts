import * as OtelResource from "@effect/opentelemetry/Resource";
import * as OtelTracer from "@effect/opentelemetry/Tracer";
import * as Layer from "effect/Layer";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";

import { requestSpanName } from "@leuchtturm/api/observability/request";

export namespace Tracing {
	export interface ServiceConfig {
		readonly name: string;
		readonly namespace: string;
	}

	export const service: ServiceConfig = {
		name: "leuchtturm-api",
		namespace: "leuchtturm",
	};

	export const layer = Layer.mergeAll(
		OtelTracer.layerGlobal.pipe(
			Layer.provide(
				OtelResource.layer({
					serviceName: service.name,
					attributes: {
						"cloud.platform": "cloudflare_workers",
						"cloud.provider": "cloudflare",
						"service.namespace": service.namespace,
					},
				}),
			),
		),
		Layer.succeed(HttpMiddleware.SpanNameGenerator, requestSpanName),
	);
}
