import { Schema, Context } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import { AuthError } from "@leuchtturm/core/auth/errors";
import type { Session, User } from "@leuchtturm/core/auth/schema";
import { UnauthorizedError } from "@leuchtturm/core/errors";

export namespace AuthMiddleware {
	export interface CurrentUserShape {
		readonly user: User;
		readonly session: Session;
	}

	export class CurrentUser extends Context.Service<CurrentUser, CurrentUserShape>()(
		"CurrentUser",
	) {}

	const MiddlewareError = Schema.Union([UnauthorizedError, AuthError]);

	export class Service extends HttpApiMiddleware.Service<Service, { provides: CurrentUser }>()(
		"AuthMiddleware",
		{ error: MiddlewareError },
	) {}
}
