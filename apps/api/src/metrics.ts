import { Cause, Effect, Exit } from "effect";
import { HttpMiddleware, HttpServerRequest } from "effect/unstable/http";
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

type HttpMetricLabels = "method" | "route" | "status" | "ok";
type DroppedMetricLabels = "pipeline";
type AuthMetricLabels = "operation" | "outcome";
type ZeroMetricLabels = "operation" | "name" | "outcome";
type AnalyticsBatchMetricLabels = "pipeline" | "outcome";
type AnalyticsInsertMetricLabels = "table" | "outcome";
type RateLimitMetricLabels = "endpoint" | "outcome";
type DatabasePoolMetricLabels = "state";

export type AuthMetricOperation = "passthrough";
export type MetricOutcome = "ok" | "error";
export type ZeroMetricOperation = "query" | "mutate";
export type AnalyticsPipeline = "events" | "errors";
export type AnalyticsBatchOutcome = "ok" | "dropped" | "rate_limited";
export type AnalyticsTable = "analytics_events" | "error_events";
export type RateLimitEndpoint = "report_errors";
export type RateLimitOutcome = "allowed" | "blocked";

type DatabasePoolSource = {
	totalCount: number;
	idleCount: number;
	waitingCount: number;
};

type MetricsState = {
	register: Registry;
	httpRequestsTotal: Counter<HttpMetricLabels>;
	httpRequestDurationSeconds: Histogram<HttpMetricLabels>;
	droppedRecordsTotal: Counter<DroppedMetricLabels>;
	authRequestsTotal: Counter<AuthMetricLabels>;
	authRequestDurationSeconds: Histogram<AuthMetricLabels>;
	zeroOperationsTotal: Counter<ZeroMetricLabels>;
	zeroOperationDurationSeconds: Histogram<ZeroMetricLabels>;
	analyticsBatchesTotal: Counter<AnalyticsBatchMetricLabels>;
	analyticsRecordsTotal: Counter<AnalyticsBatchMetricLabels>;
	analyticsInsertDurationSeconds: Histogram<AnalyticsInsertMetricLabels>;
	rateLimitChecksTotal: Counter<RateLimitMetricLabels>;
	databasePoolClients: Gauge<DatabasePoolMetricLabels>;
};

declare global {
	var __chevrotainApiMetrics: MetricsState | undefined;
}

let databasePoolSource: DatabasePoolSource | undefined;

function createMetricsState(): MetricsState {
	const register = new Registry();
	collectDefaultMetrics({ register });

	const httpRequestsTotal = new Counter({
		name: "http_requests_total",
		help: "Total HTTP requests handled by the API",
		labelNames: ["method", "route", "status", "ok"] as const,
		registers: [register],
	});

	const httpRequestDurationSeconds = new Histogram({
		name: "http_request_duration_seconds",
		help: "HTTP request duration in seconds",
		labelNames: ["method", "route", "status", "ok"] as const,
		buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
		registers: [register],
	});

	const droppedRecordsTotal = new Counter({
		name: "dropped_records_total",
		help: "Records dropped due to backend failures (e.g. ClickHouse down)",
		labelNames: ["pipeline"] as const,
		registers: [register],
	});

	const authRequestsTotal = new Counter({
		name: "chevrotain_api_auth_requests_total",
		help: "Total auth passthrough requests handled by the API",
		labelNames: ["operation", "outcome"] as const,
		registers: [register],
	});

	const authRequestDurationSeconds = new Histogram({
		name: "chevrotain_api_auth_request_duration_seconds",
		help: "Auth passthrough request duration in seconds",
		labelNames: ["operation", "outcome"] as const,
		buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
		registers: [register],
	});

	const zeroOperationsTotal = new Counter({
		name: "chevrotain_api_zero_operations_total",
		help: "Total Zero operations executed by the API",
		labelNames: ["operation", "name", "outcome"] as const,
		registers: [register],
	});

	const zeroOperationDurationSeconds = new Histogram({
		name: "chevrotain_api_zero_operation_duration_seconds",
		help: "Zero operation duration in seconds",
		labelNames: ["operation", "name", "outcome"] as const,
		buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
		registers: [register],
	});

	const analyticsBatchesTotal = new Counter({
		name: "chevrotain_api_analytics_batches_total",
		help: "Total analytics or error batches processed by the API",
		labelNames: ["pipeline", "outcome"] as const,
		registers: [register],
	});

	const analyticsRecordsTotal = new Counter({
		name: "chevrotain_api_analytics_records_total",
		help: "Total analytics or error records processed by the API",
		labelNames: ["pipeline", "outcome"] as const,
		registers: [register],
	});

	const analyticsInsertDurationSeconds = new Histogram({
		name: "chevrotain_api_analytics_insert_duration_seconds",
		help: "ClickHouse analytics insert duration in seconds",
		labelNames: ["table", "outcome"] as const,
		buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
		registers: [register],
	});

	const rateLimitChecksTotal = new Counter({
		name: "chevrotain_api_rate_limit_checks_total",
		help: "Total API rate-limit checks",
		labelNames: ["endpoint", "outcome"] as const,
		registers: [register],
	});

	const databasePoolClients = new Gauge({
		name: "chevrotain_api_db_pool_clients",
		help: "Current API database pool clients grouped by state",
		labelNames: ["state"] as const,
		registers: [register],
		collect(this: Gauge<DatabasePoolMetricLabels>) {
			this.set({ state: "total" }, databasePoolSource?.totalCount ?? 0);
			this.set({ state: "idle" }, databasePoolSource?.idleCount ?? 0);
			this.set({ state: "waiting" }, databasePoolSource?.waitingCount ?? 0);
		},
	});

	return {
		register,
		httpRequestsTotal,
		httpRequestDurationSeconds,
		droppedRecordsTotal,
		authRequestsTotal,
		authRequestDurationSeconds,
		zeroOperationsTotal,
		zeroOperationDurationSeconds,
		analyticsBatchesTotal,
		analyticsRecordsTotal,
		analyticsInsertDurationSeconds,
		rateLimitChecksTotal,
		databasePoolClients,
	};
}

const metricsState = globalThis.__chevrotainApiMetrics ?? createMetricsState();
globalThis.__chevrotainApiMetrics = metricsState;

function normalizeRoute(pathname: string): string {
	if (pathname.startsWith("/api/auth/")) {
		return "/api/auth/*";
	}

	return pathname;
}

function pathnameFromUrl(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return url.split("?")[0] ?? url;
	}
}

export function routeLabelFromUrl(url: string): string {
	return normalizeRoute(pathnameFromUrl(url));
}

function statusFromError(error: unknown): number {
	if (typeof error === "object" && error !== null) {
		const httpApiStatus = (error as { httpApiStatus?: unknown }).httpApiStatus;
		if (typeof httpApiStatus === "number") {
			return httpApiStatus;
		}
	}

	return 500;
}

export function statusFromCause(cause: Cause.Cause<unknown>): number {
	const firstFailure = cause.reasons.find(Cause.isFailReason);
	return statusFromError(firstFailure?.error);
}

function recordRequestMetric(
	method: string,
	route: string,
	status: number,
	durationSeconds: number,
): void {
	const labels = {
		method,
		route,
		status: String(status),
		ok: status < 400 ? "true" : "false",
	};

	metricsState.httpRequestsTotal.inc(labels);
	metricsState.httpRequestDurationSeconds.observe(labels, durationSeconds);
}

export const MetricsMiddleware = HttpMiddleware.make((app) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const pathname = routeLabelFromUrl(request.url);
		const startedAt = performance.now();
		const exit = yield* Effect.exit(app);
		const durationSeconds = (performance.now() - startedAt) / 1000;

		if (Exit.isSuccess(exit)) {
			recordRequestMetric(request.method, pathname, exit.value.status, durationSeconds);
			return exit.value;
		}

		const status = statusFromCause(exit.cause);
		recordRequestMetric(request.method, pathname, status, durationSeconds);
		return yield* Effect.failCause(exit.cause);
	}),
);

export const metricsText = Effect.promise(() => metricsState.register.metrics());

export function recordDroppedRecords(pipeline: string, count: number): void {
	metricsState.droppedRecordsTotal.inc({ pipeline }, count);
}

export function recordAuthRequest(
	operation: AuthMetricOperation,
	outcome: MetricOutcome,
	durationSeconds: number,
): void {
	const labels = { operation, outcome };
	metricsState.authRequestsTotal.inc(labels);
	metricsState.authRequestDurationSeconds.observe(labels, durationSeconds);
}

export function recordZeroOperation(
	operation: ZeroMetricOperation,
	name: string,
	outcome: MetricOutcome,
	durationSeconds: number,
): void {
	const labels = { operation, name, outcome };
	metricsState.zeroOperationsTotal.inc(labels);
	metricsState.zeroOperationDurationSeconds.observe(labels, durationSeconds);
}

export function recordAnalyticsBatch(
	pipeline: AnalyticsPipeline,
	outcome: AnalyticsBatchOutcome,
	recordCount: number,
): void {
	const labels = { pipeline, outcome };
	metricsState.analyticsBatchesTotal.inc(labels);
	metricsState.analyticsRecordsTotal.inc(labels, recordCount);
}

export function recordAnalyticsInsert(
	table: AnalyticsTable,
	outcome: MetricOutcome,
	durationSeconds: number,
): void {
	metricsState.analyticsInsertDurationSeconds.observe({ table, outcome }, durationSeconds);
}

export function recordRateLimitCheck(endpoint: RateLimitEndpoint, outcome: RateLimitOutcome): void {
	metricsState.rateLimitChecksTotal.inc({ endpoint, outcome });
}

export function registerDatabasePoolMetrics(source: DatabasePoolSource | undefined): void {
	databasePoolSource = source;
}
