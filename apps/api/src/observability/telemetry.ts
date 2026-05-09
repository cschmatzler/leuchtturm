import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Otlp from "effect/unstable/observability/Otlp";
import { Resource } from "sst";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";

export namespace Telemetry {
	const grafanaOtlp = JSON.parse(Resource.GrafanaOtlpUrl.value);

	export const layer = Layer.fresh(
		Layer.suspend(() =>
			Otlp.layerProtobuf({
				baseUrl: grafanaOtlp.url,
				headers: {
					Authorization: grafanaOtlp.authorization,
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
		),
	);

	export const withRequest = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
		Effect.acquireUseRelease(
			Scope.make(),
			(telemetryScope) =>
				Layer.buildWithScope(layer, telemetryScope).pipe(
					Effect.flatMap((telemetryContext) =>
						effect.pipe(Effect.provideContext(telemetryContext)),
					),
				),
			(telemetryScope) =>
				RequestContext.Service.useSync((context) => {
					context.waitUntil(Effect.runPromise(Scope.close(telemetryScope, Exit.void)));
				}),
		);
}
