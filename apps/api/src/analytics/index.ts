import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";

import { authMiddleware, type AuthVariables } from "@one/api/middleware/auth";
import { insertEvents } from "@one/core/analytics/clickhouse";
import { AnalyticsPayload } from "@one/core/analytics/schema";
import { PublicError } from "@one/core/result";

const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).post(
	"/",
	sValidator("json", AnalyticsPayload, (result) => {
		if (result.success) {
			return;
		}

		throw new PublicError({
			status: 400,
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

		await insertEvents(payload.events, user.id, session.id);
		return c.json({ success: true });
	},
);

export default app;
