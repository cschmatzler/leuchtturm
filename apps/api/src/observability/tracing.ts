import * as OtelResource from "@effect/opentelemetry/Resource";
import * as OtelTracer from "@effect/opentelemetry/Tracer";
import { Layer } from "effect";
import { HttpMiddleware } from "effect/unstable/http";

import {
	makeResourceConfig,
	traceExporterConfig as getTraceExporterConfig,
	traceServiceConfig as getTraceServiceConfig,
} from "@leuchtturm/api/observability/config";
import { requestSpanName } from "@leuchtturm/api/observability/request";

export namespace Tracing {
	export const traceExporterConfig = getTraceExporterConfig;
	export const traceServiceConfig = getTraceServiceConfig;
	export const layer = Layer.suspend(() =>
		Layer.mergeAll(
			OtelTracer.layerGlobal.pipe(Layer.provide(OtelResource.layer(makeResourceConfig()))),
			Layer.succeed(HttpMiddleware.SpanNameGenerator, requestSpanName),
		),
	);
}
