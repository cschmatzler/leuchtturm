import { Cause, Effect, Exit } from "effect";
import { HttpMiddleware, HttpServerRequest } from "effect/unstable/http";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

type HttpMetricLabels = "method" | "route" | "status" | "ok";

type MetricsState = {
	register: Registry;
	httpRequestsTotal: Counter<HttpMetricLabels>;
	httpRequestDurationSeconds: Histogram<HttpMetricLabels>;
};

declare global {
	var __chevrotainApiMetrics: MetricsState | undefined;
}

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

	return {
		register,
		httpRequestsTotal,
		httpRequestDurationSeconds,
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

function statusFromError(error: unknown): number {
	if (typeof error === "object" && error !== null) {
		const httpApiStatus = (error as { httpApiStatus?: unknown }).httpApiStatus;
		if (typeof httpApiStatus === "number") {
			return httpApiStatus;
		}

		const tag = (error as { _tag?: unknown })._tag;
		if (typeof tag === "string") {
			switch (tag) {
				case "ValidationError":
					return 400;
				case "UnauthorizedError":
					return 401;
				case "ForbiddenError":
					return 403;
				case "NotFoundError":
					return 404;
				case "RateLimitError":
					return 429;
				default:
					return 500;
			}
		}
	}

	return 500;
}

function statusFromCause(cause: Cause.Cause<unknown>): number {
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
		const pathname = normalizeRoute(pathnameFromUrl(request.url));
		const startedAt = performance.now();
		const exit = yield* Effect.exit(app);
		const durationSeconds = (performance.now() - startedAt) / 1000;

		if (Exit.isSuccess(exit)) {
			recordRequestMetric(request.method, pathname, exit.value.status, durationSeconds);
			return exit.value;
		}

		recordRequestMetric(request.method, pathname, statusFromCause(exit.cause), durationSeconds);
		return yield* Effect.failCause(exit.cause);
	}),
);

export const metricsText = Effect.promise(() => metricsState.register.metrics());
