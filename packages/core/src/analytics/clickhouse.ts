import { createClient } from "@clickhouse/client";

import type { AnalyticsEvent } from "@one/core/analytics/schema";

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

export { client as analyticsClient };
