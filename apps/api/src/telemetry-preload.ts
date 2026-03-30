import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { Config, ConfigProvider, Effect, Option } from "effect";

type TracingBootstrap = {
	provider: NodeTracerProvider;
	contextManager: AsyncLocalStorageContextManager;
	disableInstrumentations: () => void;
};

declare global {
	var __chevrotainApiTracingBootstrap: TracingBootstrap | undefined;
}

function hasOtlpExporter(exporter: string | undefined): boolean {
	if (!exporter) {
		return false;
	}

	return exporter.split(",").some((value) => value.trim() === "otlp");
}

function parseResourceAttributes(input: string | undefined): Record<string, string> {
	if (!input) {
		return {};
	}

	return Object.fromEntries(
		input
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)
			.flatMap((entry) => {
				const separatorIndex = entry.indexOf("=");

				if (separatorIndex === -1) {
					return [];
				}

				const key = entry.slice(0, separatorIndex).trim();
				const value = entry.slice(separatorIndex + 1).trim();

				return key.length === 0 ? [] : [[key, value]];
			}),
	);
}

const TelemetryPreloadConfig = Config.all({
	otlpEndpoint: Config.option(Config.string("OTEL_EXPORTER_OTLP_ENDPOINT")),
	otlpTracesEndpoint: Config.option(Config.string("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")),
	otlpTracesExporter: Config.option(Config.string("OTEL_TRACES_EXPORTER")),
	resourceAttributes: Config.option(Config.string("OTEL_RESOURCE_ATTRIBUTES")),
	serviceName: Config.option(Config.string("OTEL_SERVICE_NAME")),
	serviceVersion: Config.option(Config.string("OTEL_SERVICE_VERSION")),
});

function makeTracingBootstrap(): TracingBootstrap | undefined {
	const config = Effect.runSync(TelemetryPreloadConfig.parse(ConfigProvider.fromEnv()));
	const tracesEnabled =
		Option.isSome(config.otlpEndpoint) ||
		Option.isSome(config.otlpTracesEndpoint) ||
		hasOtlpExporter(Option.getOrUndefined(config.otlpTracesExporter));

	if (!tracesEnabled) {
		return undefined;
	}

	const resourceAttributes = parseResourceAttributes(
		Option.getOrUndefined(config.resourceAttributes),
	);

	if (Option.isSome(config.serviceName)) {
		resourceAttributes[ATTR_SERVICE_NAME] = config.serviceName.value;
	}

	if (Option.isSome(config.serviceVersion)) {
		resourceAttributes[ATTR_SERVICE_VERSION] = config.serviceVersion.value;
	}

	const provider = new NodeTracerProvider({
		resource: resourceFromAttributes(resourceAttributes),
		spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
	});
	const contextManager = new AsyncLocalStorageContextManager();
	contextManager.enable();
	provider.register({ contextManager });

	const disableInstrumentations = registerInstrumentations({
		tracerProvider: provider,
		instrumentations: [new PgInstrumentation(), new UndiciInstrumentation()],
	});

	return {
		provider,
		contextManager,
		disableInstrumentations,
	};
}

globalThis.__chevrotainApiTracingBootstrap ??= makeTracingBootstrap();

export function getTracingBootstrap(): TracingBootstrap | undefined {
	return globalThis.__chevrotainApiTracingBootstrap;
}
