import * as OtelResource from "@effect/opentelemetry/Resource";
import * as OtelTracer from "@effect/opentelemetry/Tracer";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import { Resource } from "sst";

import { requestSpanName } from "@leuchtturm/api/observability/request";

export namespace Tracing {
	const grafanaOtlp = JSON.parse(Resource.GrafanaOtlpUrl.value);

	export interface FlusherInterface {
		readonly flush: () => Promise<void | undefined>;
	}

	export class Flusher extends Context.Service<Flusher, FlusherInterface>()(
		"@leuchtturm/api/Tracing/Flusher",
	) {}

	export const layer = Layer.fresh(
		Layer.suspend(() => {
			const processor = new BatchSpanProcessor(
				new OTLPTraceExporter({
					headers: {
						Authorization: grafanaOtlp.authorization,
					},
					url: `${grafanaOtlp.url}/v1/traces`,
				}),
				{ scheduledDelayMillis: 30_000 },
			);
			const resource = OtelResource.layer({
				serviceName: "leuchtturm-api",
				attributes: {
					"service.namespace": "leuchtturm",
					app: "leuchtturm",
					stage: Resource.App.stage,
				},
			});
			const provider = Layer.effect(
				OtelTracer.OtelTracerProvider,
				Effect.acquireRelease(
					Effect.gen(function* () {
						const resource = yield* OtelResource.Resource;

						return new BasicTracerProvider({
							resource,
							spanProcessors: [processor],
						});
					}),
					() =>
						Effect.promise(() => processor.forceFlush().then(() => processor.shutdown())).pipe(
							Effect.ignore,
							Effect.interruptible,
							Effect.timeoutOption(3000),
						),
				),
			);

			return Layer.mergeAll(
				OtelTracer.layer.pipe(Layer.provide(provider), Layer.provide(resource)),
				Layer.succeed(HttpMiddleware.SpanNameGenerator, requestSpanName),
				Layer.succeed(
					Flusher,
					Flusher.of({
						flush: () =>
							new Promise<void>((resolve) => {
								setTimeout(() => setTimeout(resolve, 0), 0);
							})
								.then(() => processor.forceFlush())
								.catch(() => undefined),
					}),
				),
			);
		}),
	);
}
