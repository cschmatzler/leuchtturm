import { Middleware as HttpMiddleware } from "@leuchtturm/api/observability/http-middleware";
import {
	logError as emitErrorLog,
	logInfo as emitInfoLog,
	logWarning as emitWarningLog,
} from "@leuchtturm/api/observability/logging";
import {
	requestCount as apiRequestCount,
	requestDuration as apiRequestDuration,
	requestErrorCount as apiRequestErrorCount,
	tagMetric as withMetricTags,
	tagRequestMetric as withRequestMetricTags,
} from "@leuchtturm/api/observability/metrics";
import {
	requestLogAnnotations as buildRequestLogAnnotations,
	requestPath as getRequestPath,
	requestSpanAttributes as buildRequestSpanAttributes,
	requestSpanName as getRequestSpanName,
	statusGroup as getStatusGroup,
} from "@leuchtturm/api/observability/request";
import {
	layer as tracingLayer,
	traceExporterConfig as getTraceExporterConfig,
	traceServiceConfig as serviceTraceConfig,
} from "@leuchtturm/api/observability/tracing";

export namespace Observability {
	export const logInfo = emitInfoLog;
	export const logWarning = emitWarningLog;
	export const logError = emitErrorLog;

	export const requestCount = apiRequestCount;
	export const requestErrorCount = apiRequestErrorCount;
	export const requestDuration = apiRequestDuration;
	export const tagMetric = withMetricTags;
	export const tagRequestMetric = withRequestMetricTags;

	export const requestPath = getRequestPath;
	export const requestSpanName = getRequestSpanName;
	export const requestSpanAttributes = buildRequestSpanAttributes;
	export const requestLogAnnotations = buildRequestLogAnnotations;
	export const statusGroup = getStatusGroup;

	export const Middleware = HttpMiddleware;
	export const layer = tracingLayer;
	export const traceServiceConfig = serviceTraceConfig;
	export const traceExporterConfig = getTraceExporterConfig;
}
