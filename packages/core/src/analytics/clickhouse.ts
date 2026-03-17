import { createClient } from "@clickhouse/client";

import type { AnalyticsEvent } from "@chevrotain/core/analytics/schema";

const client = createClient({
	url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
	clickhouse_settings: {
		async_insert: 1,
		wait_end_of_query: 1,
	},
});

export async function insertEvents(events: AnalyticsEvent[], userId: string, sessionId: string) {
	const rows = events.map((event) => ({
		timestamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
		event_id: crypto.randomUUID(),
		session_id: sessionId,
		user_id: userId,
		event_type: event.eventType,
		url: event.url,
		referrer: event.referrer,
		properties: JSON.stringify(event.properties ?? {}),
	}));

	await client.insert({
		table: "analytics_events",
		values: rows,
		format: "JSONEachRow",
	});
}

type ErrorEventRow = {
	source: "api" | "web";
	errorType: string;
	message: string;
	userId?: string;
	sessionId?: string;
	stackTrace?: string;
	url?: string;
	method?: string;
	statusCode?: number;
	userAgent?: string;
	properties?: Record<string, unknown>;
};

export async function insertErrors(errors: ErrorEventRow[]) {
	const rows = errors.map((error) => ({
		timestamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
		error_id: crypto.randomUUID(),
		source: error.source,
		user_id: error.userId ?? "",
		session_id: error.sessionId ?? "",
		error_type: error.errorType,
		message: error.message,
		stack_trace: error.stackTrace ?? "",
		url: error.url ?? "",
		method: error.method ?? "",
		status_code: error.statusCode ?? 0,
		user_agent: error.userAgent ?? "",
		properties: JSON.stringify(error.properties ?? {}),
	}));

	await client.insert({
		table: "error_events",
		values: rows,
		format: "JSONEachRow",
	});
}

export { client as analyticsClient };
