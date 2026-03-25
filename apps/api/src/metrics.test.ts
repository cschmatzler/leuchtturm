import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
	metricsText,
	recordAnalyticsBatch,
	recordAnalyticsInsert,
	recordAuthRequest,
	recordRateLimitCheck,
	recordZeroOperation,
	registerDatabasePoolMetrics,
} from "@chevrotain/api/metrics";

describe("API metrics", () => {
	it("exports auth, zero, analytics, rate-limit, and db pool metrics", async () => {
		recordAuthRequest("passthrough", "error", 0.125);
		recordZeroOperation("query", "user.profile", "ok", 0.05);
		recordAnalyticsBatch("errors", "rate_limited", 3);
		recordAnalyticsInsert("error_events", "error", 0.02);
		recordRateLimitCheck("report_errors", "blocked");
		registerDatabasePoolMetrics({ totalCount: 5, idleCount: 2, waitingCount: 1 });

		const text = await Effect.runPromise(metricsText);

		expect(text).toContain(
			'chevrotain_api_auth_requests_total{operation="passthrough",outcome="error"}',
		);
		expect(text).toContain(
			'chevrotain_api_zero_operations_total{operation="query",name="user.profile",outcome="ok"}',
		);
		expect(text).toContain(
			'chevrotain_api_analytics_batches_total{pipeline="errors",outcome="rate_limited"}',
		);
		expect(text).toContain(
			'chevrotain_api_analytics_insert_duration_seconds_sum{table="error_events",outcome="error"}',
		);
		expect(text).toContain(
			'chevrotain_api_rate_limit_checks_total{endpoint="report_errors",outcome="blocked"}',
		);
		expect(text).toContain('chevrotain_api_db_pool_clients{state="total"} 5');
		expect(text).toContain('chevrotain_api_db_pool_clients{state="idle"} 2');
		expect(text).toContain('chevrotain_api_db_pool_clients{state="waiting"} 1');
	});
});
