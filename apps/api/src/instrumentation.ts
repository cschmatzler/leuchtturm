import { NodeSdk } from "@effect/opentelemetry";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Metric } from "effect";

// --- HTTP Metrics ---

/** Counter for total HTTP requests. */
export const httpRequestCount = Metric.counter("http_requests_total", {
	description: "Total number of HTTP requests",
});

/** Histogram for HTTP request duration. */
export const httpRequestDuration = Metric.histogram("http_request_duration_ms", {
	boundaries: Metric.linearBoundaries({ start: 0, width: 50, count: 20 }),
	description: "HTTP request duration in milliseconds",
});

/** Counter for HTTP errors. */
export const httpErrorCount = Metric.counter("http_errors_total", {
	description: "Total number of HTTP errors",
});

// --- OpenTelemetry Layer ---

const traceExporter = new OTLPTraceExporter();
const spanProcessor = new BatchSpanProcessor(traceExporter);

const metricExporter = new OTLPMetricExporter();
const metricReader = new PeriodicExportingMetricReader({
	exporter: metricExporter,
	exportIntervalMillis: 10000,
});

// Register instrumentations globally (OpenTelemetry pattern)
new PgInstrumentation().enable();
new UndiciInstrumentation().enable();

export const InstrumentationLive = NodeSdk.layer(() => ({
	resource: { serviceName: "chevrotain-api" },
	spanProcessor,
	metricReader,
}));

export async function shutdownTelemetry(): Promise<void> {
	// Effect's OTel handles shutdown automatically on runtime dispose
	// PeriodicExportingMetricReader flushes on export interval
}
