import { createMiddleware } from "hono/factory";

import { auth } from "@roasted/core/auth/index";
import { PublicError } from "@roasted/core/result";

type Session = typeof auth.$Infer.Session;

export type AuthVariables = {
	user: Session["user"];
	session: Session["session"];
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		throw new PublicError({ status: 401, global: [{ message: "Unauthorized" }] });
	}

	c.set("user", session.user);
	c.set("session", session.session);

	await next();
});
