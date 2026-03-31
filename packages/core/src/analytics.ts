import { createClient } from "@clickhouse/client";
import { Effect, Layer, Schema, ServiceMap } from "effect";
import { ulid } from "ulid";

import type { Event, Error as ErrorEvent } from "@chevrotain/core/analytics/schema";
import { Config } from "@chevrotain/core/config";

export namespace Analytics {
	export class Error extends Schema.TaggedErrorClass<Error>()(
		"AnalyticsError",
		{ message: Schema.String },
		{ httpApiStatus: 500 },
	) {}

	export interface Interface {
		readonly insertEvents: (
			events: Event[],
			userId: string,
			sessionId: string,
		) => Effect.Effect<void, Error>;
		readonly insertErrors: (errors: ErrorEvent[]) => Effect.Effect<void, Error>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Analytics") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const config = yield* Config;

			const client = yield* Effect.acquireRelease(
				Effect.sync(() =>
					createClient({
						url: config.analytics.clickhouseUrl,
						clickhouse_settings: { async_insert: 1, wait_end_of_query: 1 },
					}),
				),
				(client) => Effect.promise(() => client.close()),
			);

			const insertEvents = Effect.fn("Analytics.insertEvents")(function* (
				events: Event[],
				userId: string,
				sessionId: string,
			) {
				yield* Effect.tryPromise({
					try: () =>
						client.insert({
							table: "analytics_events",
							values: events.map((event) => ({
								timestamp: new Date(),
								eventId: ulid(),
								sessionId,
								userId,
								eventType: event.eventType,
								url: event.url,
								referrer: event.referrer,
								properties: event.properties,
							})),
							format: "JSONEachRow",
						}),
					catch: (error) =>
						new Error({
							message: `Failed to insert analytics events: ${error instanceof globalThis.Error ? error.message : String(error)}`,
						}),
				});
			});

			const insertErrors = Effect.fn("Analytics.insertErrors")(function* (errors: ErrorEvent[]) {
				yield* Effect.tryPromise({
					try: () =>
						client.insert({
							table: "error_events",
							values: errors.map((error) => ({
								timestamp: new Date(),
								errorId: ulid(),
								source: error.source,
								userId: error.userId ?? "",
								sessionId: error.sessionId ?? "",
								errorType: error.errorType,
								message: error.message,
								stackTrace: error.stackTrace ?? "",
								url: error.url ?? "",
								method: error.method ?? "",
								statusCode: error.statusCode ?? 0,
								userAgent: error.userAgent ?? "",
								requestId: error.requestId ?? "",
								traceId: error.traceId ?? "",
								spanId: error.spanId ?? "",
								route: error.route ?? "",
								properties: error.properties ?? {},
							})),
							format: "JSONEachRow",
						}),
					catch: (error) =>
						new Error({
							message: `Failed to insert error events: ${error instanceof globalThis.Error ? error.message : String(error)}`,
						}),
				});
			});

			return Service.of({ insertEvents, insertErrors });
		}),
	);

	export const defaultLayer = layer;
}
