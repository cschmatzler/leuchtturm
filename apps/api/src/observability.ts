import * as OtelLogger from "@effect/opentelemetry/Logger";
import * as OtelResource from "@effect/opentelemetry/Resource";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { Config, Effect, Layer, Option } from "effect";

const OtlpLogsEnabledConfig = Config.all({
	otlpEndpoint: Config.option(Config.string("OTEL_EXPORTER_OTLP_ENDPOINT")),
	otlpLogsEndpoint: Config.option(Config.string("OTEL_EXPORTER_OTLP_LOGS_ENDPOINT")),
}).pipe(
	Config.map(
		({ otlpEndpoint, otlpLogsEndpoint }) =>
			Option.isSome(otlpEndpoint) || Option.isSome(otlpLogsEndpoint),
	),
);

export const ObservabilityLive = Layer.unwrap(
	Effect.gen(function* () {
		const otlpLogsEnabled = yield* OtlpLogsEnabledConfig;

		if (!otlpLogsEnabled) {
			return Layer.empty;
		}

		return OtelLogger.layer({ mergeWithExisting: false }).pipe(
			Layer.provide(
				OtelLogger.layerLoggerProvider(new BatchLogRecordProcessor(new OTLPLogExporter())),
			),
			Layer.provide(OtelResource.layerFromEnv()),
		);
	}).pipe(Effect.orDie),
);
