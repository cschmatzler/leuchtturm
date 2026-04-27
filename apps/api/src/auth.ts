import { Context } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import { AuthErrors } from "@leuchtturm/core/auth/errors";
import { Session, User } from "@leuchtturm/core/auth/schema";
import { UnauthorizedError } from "@leuchtturm/core/errors";

export namespace AuthMiddleware {
	export interface CurrentUserShape {
		readonly user: typeof User.Type;
		readonly session: typeof Session.Type;
	}

	export class CurrentUser extends Context.Service<CurrentUser, CurrentUserShape>()(
		"CurrentUser",
	) {}

	const MiddlewareError = [UnauthorizedError, ...AuthErrors] as const;

	export class Service extends HttpApiMiddleware.Service<Service, { provides: CurrentUser }>()(
		"AuthMiddleware",
		{ error: MiddlewareError },
	) {}
}
