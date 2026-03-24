import { Effect, Option } from "effect";
import { Headers, HttpServerRequest } from "effect/unstable/http";

import { Analytics } from "@chevrotain/core/analytics/index";

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

	return analytics
		.insertErrors([
			{
				source: "api",
				errorType: details.errorType,
				message: details.message,
				...(details.stackTrace ? { stackTrace: details.stackTrace } : {}),
				url: request.url,
				method: request.method,
				statusCode,
				userAgent,
			},
		])
		.pipe(
			Effect.catchTag("AnalyticsError", (analyticsError) =>
				Effect.logError("API error insert failed, dropping error").pipe(
					Effect.annotateLogs("error", analyticsError.message),
					Effect.annotateLogs("statusCode", String(statusCode)),
					Effect.annotateLogs("method", request.method),
					Effect.annotateLogs("url", request.url),
				),
			),
		);
}
