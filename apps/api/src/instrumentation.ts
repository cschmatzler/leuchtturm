import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

const resource = resourceFromAttributes({
	"service.name": "one-api",
});

const contextManager = new AsyncLocalStorageContextManager();
context.setGlobalContextManager(contextManager);

const tracerProvider = new BasicTracerProvider({
	resource,
	spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
});
trace.setGlobalTracerProvider(tracerProvider);

registerInstrumentations({
	tracerProvider,
	instrumentations: [new PgInstrumentation(), new UndiciInstrumentation()],
});

export async function shutdownTelemetry() {
	await tracerProvider.shutdown();
}
