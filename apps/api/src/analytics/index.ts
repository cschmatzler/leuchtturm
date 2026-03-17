import { sValidator } from "@hono/standard-validator";
import { Effect } from "effect";
import { Hono } from "hono";

import { authMiddleware, type AuthVariables } from "@one/api/middleware/auth";
import { runEffect } from "@one/api/runtime";
import { AnalyticsPayload } from "@one/core/analytics/schema";
import { ClickHouseService } from "@one/core/analytics/service";
import { ValidationError } from "@one/core/errors";

const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).post(
	"/",
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
