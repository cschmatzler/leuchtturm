import { createClient } from "@clickhouse/client";
import { Config, Effect, Layer, ServiceMap } from "effect";

import type { AnalyticsEvent } from "@chevrotain/core/analytics/schema";
import { ClickHouseError } from "@chevrotain/core/errors";

export type ErrorEventRow = {
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

export interface ClickHouseServiceShape {
	readonly insertEvents: (
		events: AnalyticsEvent[],
		userId: string,
		sessionId: string,
	) => Effect.Effect<void, ClickHouseError>;
	readonly insertErrors: (errors: ErrorEventRow[]) => Effect.Effect<void, ClickHouseError>;
}

export class ClickHouseService extends ServiceMap.Service<
	ClickHouseService,
	ClickHouseServiceShape
>()("ClickHouseService") {}

export const ClickHouseServiceLive = Layer.effect(ClickHouseService)(
	Effect.gen(function* () {
		const clickhouseUrl = yield* Config.string("CLICKHOUSE_URL").pipe(
			Config.withDefault("http://localhost:8123"),
		);

		yield* Effect.logInfo("ClickHouseService initializing").pipe(
			Effect.annotateLogs("url", clickhouseUrl),
		);

		const client = yield* Effect.acquireRelease(
			Effect.sync(() =>
				createClient({
					url: clickhouseUrl,
					clickhouse_settings: { async_insert: 1, wait_end_of_query: 1 },
				}),
			),
			(c) => Effect.promise(() => c.close()),
		);

		const insertEvents = (
			events: AnalyticsEvent[],
			userId: string,
			sessionId: string,
		): Effect.Effect<void, ClickHouseError> =>
			Effect.tryPromise({
				try: () =>
					client.insert({
						table: "analytics_events",
						values: events.map((event) => ({
							timestamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
							event_id: crypto.randomUUID(),
							session_id: sessionId,
							user_id: userId,
							event_type: event.eventType,
							url: event.url,
							referrer: event.referrer,
							properties: JSON.stringify(event.properties ?? {}),
						})),
						format: "JSONEachRow",
					}),
				catch: () => new ClickHouseError({ message: "Failed to insert analytics events" }),
			});

		const insertErrors = (errors: ErrorEventRow[]): Effect.Effect<void, ClickHouseError> =>
			Effect.tryPromise({
				try: () =>
					client.insert({
						table: "error_events",
						values: errors.map((error) => ({
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
						})),
						format: "JSONEachRow",
					}),
				catch: () => new ClickHouseError({ message: "Failed to insert error events" }),
			});

		return { insertEvents, insertErrors };
	}),
);
