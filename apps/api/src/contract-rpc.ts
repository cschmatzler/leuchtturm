import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { RpcAuthMiddleware } from "@chevrotain/api/middleware/auth";
import { AnalyticsPayload, ErrorPayload } from "@chevrotain/core/analytics/schema";
import { ClickHouseError, RateLimitError, ValidationError } from "@chevrotain/core/errors";

const SuccessResponse = Schema.Struct({ success: Schema.Literal(true) });

const IngestEvents = Rpc.make("IngestEvents", {
	payload: AnalyticsPayload,
	success: SuccessResponse,
	error: Schema.Union([ValidationError, ClickHouseError]),
}).middleware(RpcAuthMiddleware);

const ReportErrors = Rpc.make("ReportErrors", {
	payload: ErrorPayload,
	success: SuccessResponse,
	error: Schema.Union([ValidationError, RateLimitError, ClickHouseError]),
});

const HealthCheck = Rpc.make("HealthCheck", {
	success: SuccessResponse,
});

export const ChevrotainRpcs = RpcGroup.make(IngestEvents, ReportErrors, HealthCheck);
