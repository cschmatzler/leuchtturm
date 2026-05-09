import * as OtelLogger from "@effect/opentelemetry/Logger";
import * as OtelResource from "@effect/opentelemetry/Resource";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import * as Layer from "effect/Layer";

import { getLogConfig, makeResourceConfig } from "@leuchtturm/api/observability/config";

export namespace Logging {
	export const layer = Layer.suspend(() => {
		const config = getLogConfig();

		return OtelLogger.layer({ mergeWithExisting: true }).pipe(
			Layer.provide(
				OtelLogger.layerLoggerProvider(
					new BatchLogRecordProcessor(
						new OTLPLogExporter({
							headers: {
								Authorization: `Bearer ${config.token}`,
							},
							url: config.url,
						}),
					),
				),
			),
			Layer.provide(OtelResource.layer(makeResourceConfig())),
		);
	});
}
