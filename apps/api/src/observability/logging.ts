import * as OtelLogger from "@effect/opentelemetry/Logger";
import * as OtelResource from "@effect/opentelemetry/Resource";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import * as Layer from "effect/Layer";
import { Resource } from "sst";

export namespace Logging {
	export const layer = Layer.suspend(() =>
		OtelLogger.layer({ mergeWithExisting: true }).pipe(
			Layer.provide(
				OtelLogger.layerLoggerProvider(
					new BatchLogRecordProcessor(
						new OTLPLogExporter({
							headers: {
								Authorization: `Bearer ${Resource.GrafanaApiToken.value}`,
							},
							url: `${Resource.GrafanaOtlpUrl.value}/v1/logs`,
						}),
					),
				),
			),
			Layer.provide(
				OtelResource.layer({
					serviceName: "leuchtturm-api",
					attributes: {
						"service.namespace": "leuchtturm",
					},
				}),
			),
		),
	);
}
