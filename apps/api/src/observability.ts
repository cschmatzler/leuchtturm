import * as OtelLogger from "@effect/opentelemetry/Logger";
import * as OtelResource from "@effect/opentelemetry/Resource";
import * as OtelTracer from "@effect/opentelemetry/Tracer";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { Config, Effect, Layer, Option } from "effect";

import { getTracingBootstrap } from "@chevrotain/api/telemetry-preload";

function hasOtlpExporter(exporter: Option.Option<string>): boolean {
	return Option.match(exporter, {
		onNone: () => false,
		onSome: (value) => value.split(",").some((part) => part.trim() === "otlp"),
	});
}

const OtlpEnabledConfig = Config.all({
	otlpEndpoint: Config.option(Config.string("OTEL_EXPORTER_OTLP_ENDPOINT")),
	otlpLogsExporter: Config.option(Config.string("OTEL_LOGS_EXPORTER")),
	otlpLogsEndpoint: Config.option(Config.string("OTEL_EXPORTER_OTLP_LOGS_ENDPOINT")),
	otlpTracesExporter: Config.option(Config.string("OTEL_TRACES_EXPORTER")),
	otlpTracesEndpoint: Config.option(Config.string("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")),
}).pipe(
	Config.map(
		({
			otlpEndpoint,
			otlpLogsExporter,
			otlpLogsEndpoint,
			otlpTracesExporter,
			otlpTracesEndpoint,
		}) => ({
			logsEnabled:
				Option.isSome(otlpEndpoint) ||
				Option.isSome(otlpLogsEndpoint) ||
				hasOtlpExporter(otlpLogsExporter),
			tracesEnabled:
				Option.isSome(otlpEndpoint) ||
				Option.isSome(otlpTracesEndpoint) ||
				hasOtlpExporter(otlpTracesExporter),
		}),
	),
);

const TracingShutdownLive = Layer.effectDiscard(
	Effect.acquireRelease(
		Effect.sync(() => getTracingBootstrap()),
		(bootstrap) =>
			bootstrap
				? Effect.promise(() =>
						bootstrap.provider
							.forceFlush()
							.then(() => bootstrap.provider.shutdown())
							.finally(() => {
								bootstrap.disableInstrumentations();
								bootstrap.contextManager.disable();
							}),
					).pipe(Effect.ignore)
				: Effect.void,
	),
);

export const ObservabilityLive = Layer.unwrap(
	Effect.gen(function* () {
		const { logsEnabled, tracesEnabled } = yield* OtlpEnabledConfig;

		if (!logsEnabled && !tracesEnabled) {
			return Layer.empty;
		}

		const LoggingLive = OtelLogger.layer({ mergeWithExisting: false }).pipe(
			Layer.provide(
				OtelLogger.layerLoggerProvider(new BatchLogRecordProcessor(new OTLPLogExporter())),
			),
			Layer.provide(OtelResource.layerFromEnv()),
		);

		const TracingLive = Layer.mergeAll(OtelTracer.layerGlobal, TracingShutdownLive).pipe(
			Layer.provide(OtelResource.layerFromEnv()),
		);

		if (logsEnabled && tracesEnabled) {
			return Layer.mergeAll(LoggingLive, TracingLive);
		}

		return logsEnabled ? LoggingLive : TracingLive;
	}).pipe(Effect.orDie),
);
