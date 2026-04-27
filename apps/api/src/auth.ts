import { Context } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import { Errors } from "@leuchtturm/api/errors";
import { Session, User } from "@leuchtturm/core/auth/schema";

export namespace AuthMiddleware {
	export interface CurrentUserShape {
		readonly user: typeof User.Type;
		readonly session: typeof Session.Type;
	}

	export class CurrentUser extends Context.Service<CurrentUser, CurrentUserShape>()(
		"CurrentUser",
	) {}

	export class Service extends HttpApiMiddleware.Service<Service, { provides: CurrentUser }>()(
		"AuthMiddleware",
		{ error: Errors },
	) {}
}
