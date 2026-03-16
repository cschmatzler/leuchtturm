import { mustGetMutator } from "@rocicorp/zero";
import { handleMutateRequest } from "@rocicorp/zero/server";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { Hono } from "hono";

import { authMiddleware, type AuthVariables } from "@one/api/middleware/auth";
import { db } from "@one/core/drizzle/index";
import { mutators } from "@one/zero/mutators";
import { schema } from "@one/zero/schema";

const dbProvider = zeroDrizzle(schema, db);

const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).post("/", async (c) => {
	const user = c.get("user");
	const ctx = { userId: user.id };

	const result = await handleMutateRequest(
		dbProvider,
		async (transact) => {
			return await transact(async (tx, name, args) => {
				const mutator = mustGetMutator(mutators, name);
				return await mutator.fn({ tx, ctx, args });
			});
		},
		c.req.raw,
	);

	return c.json(result);
});

export default app;
