import { autumnHandler } from "autumn-js/backend";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { authMiddleware, type AuthVariables } from "@chevrotain/api/middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).all("/*", async (c) => {
	const user = c.get("user");

	const body = c.req.method !== "GET" ? await c.req.json() : null;

	const { statusCode, response } = await autumnHandler({
		customerId: user.id,
		customerData: {
			name: user.name,
			email: user.email,
		},
		request: {
			url: c.req.url,
			method: c.req.method,
			body,
		},
	});

	return c.json(response, statusCode as ContentfulStatusCode);
});

export default app;
