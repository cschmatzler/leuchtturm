import { Cause, Effect, Exit, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";

import {
	recordAnalyticsBatch,
	recordAnalyticsInsert,
	routeLabelFromUrl,
} from "@chevrotain/api/metrics";
import { RequestContext } from "@chevrotain/api/middleware/request-context";
import { Analytics } from "@chevrotain/core/analytics/index";
import { Config } from "@chevrotain/core/config";

const API_SERVICE_NAMESPACE = "chevrotain";
const API_SERVICE_NAME = "api";

type ApiErrorDetails = {
	errorType: string;
	message: string;
	stackTrace?: string;
};

function getStringProperty(value: unknown, key: string): string | undefined {
	if (typeof value !== "object" || value === null) {
		return undefined;
	}

	const property = (value as Record<string, unknown>)[key];
	return typeof property === "string" ? property : undefined;
}

function getNonEmptyString(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function getErrorDetails(error: unknown, fallbackMessage: string): ApiErrorDetails {
	const errorType =
		getNonEmptyString(getStringProperty(error, "_tag")) ??
		(error instanceof Error ? getNonEmptyString(error.name) : undefined) ??
		getNonEmptyString(getStringProperty(error, "name")) ??
		"ApiError";

	const message =
		getNonEmptyString(error instanceof Error ? error.message : undefined) ??
		getNonEmptyString(getStringProperty(error, "message")) ??
		(typeof error === "string" ? getNonEmptyString(error) : undefined) ??
		fallbackMessage;

	const stackTrace =
		getNonEmptyString(error instanceof Error ? error.stack : undefined) ??
		getNonEmptyString(getStringProperty(error, "stack")) ??
		getNonEmptyString(getStringProperty(error, "stackTrace"));

	return {
		errorType,
		message,
		...(stackTrace ? { stackTrace } : {}),
	};
}

function getRequestId(request: HttpServerRequest.HttpServerRequest): string | undefined {
	const requestId = Headers.get(request.headers, "x-request-id").pipe(Option.getOrUndefined);
	return getNonEmptyString(requestId);
}

const deploymentEnvironment = Effect.runSync(
	Effect.gen(function* () {
		const config = yield* Config;
		return config.observability.deploymentEnvironment;
	}).pipe(Effect.orElseSucceed(() => undefined)),
);

export function reportApiError(
	analytics: Analytics.Interface | null,
	{
		request,
		statusCode,
		error,
		fallbackMessage,
	}: {
		request: HttpServerRequest.HttpServerRequest;
		statusCode: number;
		error?: unknown;
		fallbackMessage?: string;
	},
) {
	if (!analytics) {
		return Effect.void;
	}

	const details = getErrorDetails(error, fallbackMessage ?? `HTTP ${statusCode} response`);
	const userAgent = Headers.get(request.headers, "user-agent").pipe(Option.getOrElse(() => ""));

	return Effect.gen(function* () {
		const requestContext = yield* Effect.serviceOption(RequestContext);
		const currentSpan = yield* Effect.catchNoSuchElement(Effect.currentSpan);

		const requestId = Option.match(requestContext, {
			onNone: () => getRequestId(request),
			onSome: ({ requestId }) => requestId,
		});
		const route = Option.match(requestContext, {
			onNone: () => routeLabelFromUrl(request.url),
			onSome: ({ route }) => route,
		});
		const traceId = Option.match(currentSpan, {
			onNone: () => undefined,
			onSome: (span) => span.traceId,
		});
		const spanId = Option.match(currentSpan, {
			onNone: () => undefined,
			onSome: (span) => span.spanId,
		});
		const startedAt = performance.now();

		const exit = yield* Effect.exit(
			analytics.insertErrors([
				{
					source: "api",
					errorType: details.errorType,
					message: details.message,
					...(details.stackTrace ? { stackTrace: details.stackTrace } : {}),
					url: request.url,
					method: request.method,
					statusCode,
					userAgent,
					...(requestId ? { requestId } : {}),
					...(route ? { route } : {}),
					...(traceId ? { traceId } : {}),
					...(spanId ? { spanId } : {}),
					serviceNamespace: API_SERVICE_NAMESPACE,
					serviceName: API_SERVICE_NAME,
					...(deploymentEnvironment ? { deploymentEnvironment } : {}),
				},
			]),
		);
		const durationSeconds = (performance.now() - startedAt) / 1000;

		if (Exit.isSuccess(exit)) {
			recordAnalyticsBatch("errors", "ok", 1);
			recordAnalyticsInsert("error_events", "ok", durationSeconds);
			return;
		}

		recordAnalyticsBatch("errors", "dropped", 1);
		recordAnalyticsInsert("error_events", "error", durationSeconds);

		const analyticsError = exit.cause.reasons.find(Cause.isFailReason);
		let logEffect = Effect.logError("API error insert failed, dropping error").pipe(
			Effect.annotateLogs(
				"error",
				analyticsError?.error instanceof Analytics.Error
					? analyticsError.error.message
					: Cause.pretty(exit.cause),
			),
			Effect.annotateLogs("statusCode", String(statusCode)),
			Effect.annotateLogs("method", request.method),
			Effect.annotateLogs("route", route),
			Effect.annotateLogs("url", request.url),
		);

		if (requestId) {
			logEffect = logEffect.pipe(Effect.annotateLogs("requestId", requestId));
		}

		if (traceId) {
			logEffect = logEffect.pipe(Effect.annotateLogs("traceId", traceId));
		}

		if (spanId) {
			logEffect = logEffect.pipe(Effect.annotateLogs("spanId", spanId));
		}

		yield* logEffect;
	});
}
