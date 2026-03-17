import { sValidator } from "@hono/standard-validator";
import { Effect } from "effect";
import { Hono } from "hono";

import { authMiddleware, type AuthVariables } from "@chevrotain/api/middleware/auth";
import { runEffect } from "@chevrotain/api/runtime";
import { AnalyticsPayload } from "@chevrotain/core/analytics/schema";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { ValidationError } from "@chevrotain/core/errors";

const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).post(
	"/",
	// Throw-at-boundary: sValidator runs in Hono middleware, outside the Effect pipeline.
	// TaggedErrors thrown here are caught by Hono's .onError → isTaggedError → mapped response.
	sValidator("json", AnalyticsPayload, (result) => {
		if (result.success) {
			return;
		}

		throw new ValidationError({
			global: [{ message: "Invalid analytics payload" }],
		});
	}),
	async (c) => {
		const user = c.get("user");
		const session = c.get("session");
		const payload = c.req.valid("json");

		if (payload.events.length === 0) {
			return c.json({ success: true });
		}

		await runEffect(
			Effect.gen(function* () {
				const analytics = yield* ClickHouseService;
				yield* analytics.insertEvents(payload.events, user.id, session.id);
			}),
		);

		return c.json({ success: true });
	},
);

export default app;
