import * as OtelLogger from "@effect/opentelemetry/Logger";
import * as OtelResource from "@effect/opentelemetry/Resource";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import * as Layer from "effect/Layer";
import { Resource } from "sst";

export namespace Logging {
	const grafanaOtlp = JSON.parse(Resource.GrafanaOtlpUrl.value);

	export const layer = Layer.suspend(() =>
		OtelLogger.layer({ mergeWithExisting: true }).pipe(
			Layer.provide(
				OtelLogger.layerLoggerProvider(
					new SimpleLogRecordProcessor(
						new OTLPLogExporter({
							headers: {
								Authorization: grafanaOtlp.authorization,
							},
							url: `${grafanaOtlp.url}/v1/logs`,
						}),
					),
				),
			),
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
	);
}
