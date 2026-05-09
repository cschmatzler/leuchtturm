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
								Authorization: `Basic ${btoa(`${(Resource.GrafanaOtlpUrl as unknown as { username: string }).username}:${Resource.GrafanaApiToken.value}`)}`,
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
