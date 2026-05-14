import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Scope from "effect/Scope";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as OtlpLogger from "effect/unstable/observability/OtlpLogger";
import * as OtlpMetrics from "effect/unstable/observability/OtlpMetrics";
import * as OtlpSerialization from "effect/unstable/observability/OtlpSerialization";
import * as OtlpTracer from "effect/unstable/observability/OtlpTracer";
import { Resource } from "sst/resource/cloudflare";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";

export namespace Telemetry {
	const otlpConfig = () => JSON.parse(Resource.GrafanaOtlpConfig.value);

	const resource = {
		serviceName: "leuchtturm-api",
		attributes: {
			"service.namespace": "leuchtturm",
			app: "leuchtturm",
			stage: Resource.App.stage,
		},
	};

	const exportLayer = Layer.fresh(
		Layer.suspend(() =>
			Layer.mergeAll(
				OtlpTracer.layer({
					headers: { Authorization: otlpConfig().authorization },
					resource,
					shutdownTimeout: "3 seconds",
					url: `${otlpConfig().url}/v1/traces`,
				}),
				OtlpLogger.layer({
					excludeLogSpans: false,
					headers: { Authorization: otlpConfig().authorization },
					mergeWithExisting: true,
					resource,
					shutdownTimeout: "3 seconds",
					url: `${otlpConfig().url}/v1/logs`,
				}),
				OtlpMetrics.layer({
					headers: { Authorization: otlpConfig().authorization },
					resource,
					shutdownTimeout: "3 seconds",
					url: `${otlpConfig().url}/v1/metrics`,
				}),
			).pipe(Layer.provide(OtlpSerialization.layerProtobuf), Layer.provide(FetchHttpClient.layer)),
		),
	);

	export const withRequestContext =
		(requestContext: ReturnType<typeof RequestContext.make>) =>
		<A, E, R>(effect: Effect.Effect<A, E, R>) =>
			Effect.acquireUseRelease(
				Scope.make(),
				(telemetryScope) =>
					Layer.buildWithScope(exportLayer, telemetryScope).pipe(
						Effect.flatMap((telemetryContext) =>
							effect.pipe(Effect.provideContext(Context.merge(requestContext, telemetryContext))),
						),
					),
				(telemetryScope) =>
					Effect.sync(() => {
						Context.get(requestContext, RequestContext.Service).waitUntil(
							Effect.runPromise(Scope.close(telemetryScope, Exit.void)),
						);
					}),
			);

	export const layer = Layer.succeed(
		HttpMiddleware.SpanNameGenerator,
		(request: HttpServerRequest.HttpServerRequest) =>
			`${request.method} ${Option.getOrElse(
				Option.map(HttpServerRequest.toURL(request), (url) => url.pathname),
				() => request.url,
			)}`,
	);
}
