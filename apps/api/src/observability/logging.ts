import * as OtelLogger from "@effect/opentelemetry/Logger";
import * as OtelResource from "@effect/opentelemetry/Resource";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import { Resource } from "sst";

export namespace Logging {
	const grafanaOtlp = JSON.parse(Resource.GrafanaOtlpUrl.value);

	export interface FlusherInterface {
		readonly flush: () => Promise<void | undefined>;
	}

	export class Flusher extends Context.Service<Flusher, FlusherInterface>()(
		"@leuchtturm/api/Logging/Flusher",
	) {}

	export const layer = Layer.fresh(
		Layer.suspend(() => {
			const processor = new BatchLogRecordProcessor(
				new OTLPLogExporter({
					headers: {
						Authorization: grafanaOtlp.authorization,
					},
					url: `${grafanaOtlp.url}/v1/logs`,
				}),
				{ scheduledDelayMillis: 30_000 },
			);

			return Layer.mergeAll(
				OtelLogger.layer({ mergeWithExisting: true }).pipe(
					Layer.provide(OtelLogger.layerLoggerProvider(processor)),
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
					Flusher,
					Flusher.of({
						flush: () => processor.forceFlush().catch(() => undefined),
					}),
				),
			);
		}),
	);
}
