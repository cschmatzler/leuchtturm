import * as OtelResource from "@effect/opentelemetry/Resource";
import * as OtelTracer from "@effect/opentelemetry/Tracer";
import * as Layer from "effect/Layer";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";

import { makeResourceConfig } from "@leuchtturm/api/observability/config";
import { requestSpanName } from "@leuchtturm/api/observability/request";

export const layer = Layer.suspend(() =>
	Layer.mergeAll(
		OtelTracer.layerGlobal.pipe(Layer.provide(OtelResource.layer(makeResourceConfig()))),
		Layer.succeed(HttpMiddleware.SpanNameGenerator, requestSpanName),
	),
);
