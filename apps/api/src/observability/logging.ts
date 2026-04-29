import { Context, Effect, Logger, Option, References } from "effect";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { serviceName, serviceNamespace, getLogConfig } from "@leuchtturm/api/observability/config";
import { RequestRuntime } from "@leuchtturm/api/request-runtime";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type LogLevel = "debug" | "error" | "fatal" | "info" | "trace" | "warn";

export type Fetch = typeof fetch;

const rawFetch = globalThis.fetch.bind(globalThis);
const objectType = Object.prototype.toString;

const isDate = (value: unknown): value is Date => objectType.call(value) === "[object Date]";

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

	if (isDate(value)) {
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
	const value = Array.isArray(message) && message.length === 1 ? message[0] : message;
	const serialized = serializeLogValue(value);

	if (typeof serialized === "string") {
		return serialized;
	}

	return JSON.stringify(serialized);
};

const toLogLevel = (level: Logger.Options<unknown>["logLevel"]): LogLevel | undefined => {
	if (level === "All" || level === "None") return undefined;
	if (level === "Warn") return "warn";
	return level.toLowerCase() as LogLevel;
};

const ingestPayload = async (
	fetcher: Fetch,
	config: ReturnType<typeof getLogConfig>,
	payload: Record<string, unknown>,
) => {
	try {
		const response = await fetcher(
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

export const makeAxiomLogger = (
	config: ReturnType<typeof getLogConfig>,
	fetcher: Fetch = rawFetch,
): Logger.Logger<unknown, void> =>
	Logger.make((options) => {
		const level = toLogLevel(options.logLevel);
		if (!level) return;

		const logAnnotations = Object.fromEntries(
			Object.entries(options.fiber.getRef(References.CurrentLogAnnotations)).map(([key, value]) => [
				key,
				serializeLogValue(value),
			]),
		);
		const currentSpan = options.fiber.currentSpan;
		const spanAnnotations =
			currentSpan?._tag === "Span"
				? {
						...(currentSpan.attributes.has("error.original_cause")
							? {
									original_cause: serializeLogValue(
										currentSpan.attributes.get("error.original_cause"),
									),
								}
							: {}),
						...(currentSpan.attributes.has("request.error")
							? {
									request_error: serializeLogValue(currentSpan.attributes.get("request.error")),
								}
							: {}),
					}
				: {};
		const currentRequest = Context.getOption(options.fiber.context, RequestContext.Current);
		const requestAnnotations = Option.isSome(currentRequest)
			? {
					method: currentRequest.value.method,
					path: currentRequest.value.path,
					requestId: currentRequest.value.requestId,
				}
			: {};
		const logSpans = Object.fromEntries(
			options.fiber
				.getRef(References.CurrentLogSpans)
				.map(([label, startTime]) => [label, options.date.getTime() - startTime] as const)
				.filter(([, duration]) => Number.isFinite(duration)),
		);
		const mergedAnnotations = {
			...requestAnnotations,
			...spanAnnotations,
			...logAnnotations,
		};
		const payload = {
			_time: options.date.toISOString(),
			level,
			log_spans: logSpans,
			message: formatLogMessage(options.message),
			requestId:
				mergedAnnotations.requestId ??
				(currentSpan?._tag === "Span"
					? serializeLogValue(currentSpan.attributes.get("http.request.id"))
					: null),
			service_name: serviceName,
			service_namespace: serviceNamespace,
			...mergedAnnotations,
			...(currentSpan
				? {
						span_id: currentSpan.spanId,
						trace_id: currentSpan.traceId,
					}
				: {}),
		};
		const promise = ingestPayload(fetcher, config, payload);
		const runtime = Context.getOption(options.fiber.context, RequestRuntime.Service);

		if (Option.isSome(runtime) && runtime.value.waitUntil) {
			runtime.value.waitUntil(promise);
			return;
		}

		void promise;
	});

export namespace Logging {
	export const layer = Logger.layer([Effect.sync(() => makeAxiomLogger(getLogConfig()))], {
		mergeWithExisting: true,
	});
}
