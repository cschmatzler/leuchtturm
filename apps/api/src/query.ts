import { mustGetQuery, type ReadonlyJSONValue } from "@rocicorp/zero";
import { handleQueryRequest } from "@rocicorp/zero/server";
import { Hono } from "hono";

import { authMiddleware, type AuthVariables } from "@one/api/middleware/auth";
import { queries } from "@one/zero/queries";
import { schema } from "@one/zero/schema";

const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).post("/", async (c) => {
	const user = c.get("user");

	const result = await handleQueryRequest(
		(name: string, args: ReadonlyJSONValue | undefined) => {
			const query = mustGetQuery(queries, name);
			return query.fn({ args, ctx: { userId: user.id } });
		},
		schema,
		c.req.raw,
	);

	return c.json(result);
});

export default app;
