import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { ClickHouseService } from "@chevrotain/core/analytics/service";

export const AnalyticsHandlerLive = HttpApiBuilder.group(ChevrotainApi, "analytics", (handlers) =>
	handlers.handle("ingestEvents", ({ payload }) =>
		Effect.gen(function* () {
			if (payload.events.length === 0) {
				return { success: true as const };
			}
			const { user, session } = yield* CurrentUser;
			const analytics = yield* ClickHouseService;
			yield* analytics.insertEvents([...payload.events], user.id, session.id);
			return { success: true as const };
		}),
	),
);
