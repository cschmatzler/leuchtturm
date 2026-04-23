import { Effect, Option, References } from "effect";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { serviceName, serviceNamespace, getLogConfig } from "@leuchtturm/api/observability/config";
import { RequestRuntime } from "@leuchtturm/api/request-runtime";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type LogLevel = "info" | "warn" | "error";

type LogEvent = {
	readonly annotations?: Record<string, unknown>;
	readonly level: LogLevel;
	readonly message: string;
};

const rawFetch = globalThis.fetch.bind(globalThis);

const serializeLogValue = (value: unknown, depth = 0): JsonValue => {
	if (depth > 5) {
		return "[MaxDepthExceeded]";
	}

	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
		return value;
	}

	if (typeof value === "bigint") {
		return value.toString();
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (Array.isArray(value)) {
		return value.map((item) => serializeLogValue(item, depth + 1));
	}

	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, serializeLogValue(item, depth + 1)]),
		);
	}

	if (typeof value === "function") {
		return `[Function ${value.name || "anonymous"}]`;
	}

	if (typeof value === "symbol") {
		return value.description ?? value.toString();
	}

	return JSON.stringify(value);
};

const formatLogMessage = (message: unknown) => {
	const serialized = serializeLogValue(message);

	if (typeof serialized === "string") {
		return serialized;
	}

	return JSON.stringify(serialized);
};

const ingestPayload = async (
	config: ReturnType<typeof getLogConfig>,
	payload: Record<string, unknown>,
) => {
	try {
		const response = await rawFetch(
			`https://${config.domain}/v1/datasets/${config.dataset}/ingest`,
			{
				body: JSON.stringify([payload]),
				headers: {
					Authorization: `Bearer ${config.token}`,
					"Content-Type": "application/json",
				},
				method: "POST",
			},
		);
		const result = (await response.json()) as {
			readonly failed?: number;
			readonly failures?: unknown[];
			readonly ingested?: number;
		};

		if (!response.ok || (result.failed ?? 0) > 0 || (result.ingested ?? 0) < 1) {
			console.error("Failed to ingest log event into Axiom", {
				payload,
				result,
				status: response.status,
			});
		}
	} catch (error) {
		console.error("Failed to ingest log event into Axiom", error);
	}
};

const emit = (event: LogEvent) =>
	Effect.gen(function* () {
		const config = getLogConfig();
		const logAnnotations = Object.fromEntries(
			Object.entries(yield* References.CurrentLogAnnotations).map(([key, value]) => [
				key,
				serializeLogValue(value),
			]),
		);
		const currentSpan = yield* Effect.option(Effect.currentSpan);
		const currentRequest = yield* Effect.serviceOption(RequestContext.Current);
		const requestAnnotations = Option.isSome(currentRequest)
			? {
					method: currentRequest.value.method,
					path: currentRequest.value.path,
					requestId: currentRequest.value.requestId,
				}
			: {};
		const logSpans = Object.fromEntries(
			(yield* References.CurrentLogSpans)
				.map(([label, startTime]) => [label, Date.now() - startTime] as const)
				.filter(([, duration]) => Number.isFinite(duration)),
		);
		const mergedAnnotations = {
			...requestAnnotations,
			...logAnnotations,
			...Object.fromEntries(
				Object.entries(event.annotations ?? {}).map(([key, value]) => [
					key,
					serializeLogValue(value),
				]),
			),
		};
		const payload = {
			_time: new Date().toISOString(),
			deployment_environment: config.deploymentEnvironment,
			level: event.level,
			log_spans: logSpans,
			message: formatLogMessage(event.message),
			requestId:
				mergedAnnotations.requestId ??
				(Option.isSome(currentSpan)
					? serializeLogValue(currentSpan.value.attributes.get("http.request.id"))
					: null),
			service_name: serviceName,
			service_namespace: serviceNamespace,
			...mergedAnnotations,
			...(Option.isSome(currentSpan)
				? {
						span_id: currentSpan.value.spanId,
						trace_id: currentSpan.value.traceId,
					}
				: {}),
		};

		yield* RequestRuntime.register(ingestPayload(config, payload));
	});

const log = (level: LogLevel, message: string, annotations: Record<string, unknown> = {}) =>
	Effect.gen(function* () {
		if (level === "error") {
			yield* Effect.logError(message).pipe(Effect.annotateLogs(annotations));
		} else if (level === "warn") {
			yield* Effect.logWarning(message).pipe(Effect.annotateLogs(annotations));
		} else {
			yield* Effect.logInfo(message).pipe(Effect.annotateLogs(annotations));
		}

		yield* emit({ annotations, level, message });
	});

export const logInfo = (message: string, annotations: Record<string, unknown> = {}) =>
	log("info", message, annotations);

export const logWarning = (message: string, annotations: Record<string, unknown> = {}) =>
	log("warn", message, annotations);

export const logError = (message: string, annotations: Record<string, unknown> = {}) =>
	log("error", message, annotations);
