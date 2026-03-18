import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { ClickHouseService } from "@chevrotain/core/analytics/service";

export const AnalyticsHandlerLive = HttpApiBuilder.group(ChevrotainApi, "analytics", (handlers) =>
	handlers.handle(
		"ingestEvents",
		Effect.fn("analytics.ingestEvents")(function* ({ payload }) {
			if (payload.events.length === 0) {
				return { success: true as const };
			}
			const { user, session } = yield* CurrentUser;
			const analytics = yield* ClickHouseService;
			// Analytics ingestion is best-effort — don't fail the client request if ClickHouse is down.
			yield* analytics
				.insertEvents([...payload.events], user.id, session.id)
				.pipe(
					Effect.catchTag("ClickHouseError", (e) =>
						Effect.logError("Analytics insert failed, dropping events").pipe(
							Effect.annotateLogs("error", e.message),
							Effect.annotateLogs("eventCount", String(payload.events.length)),
						),
					),
				);
			return { success: true as const };
		}),
	),
);
