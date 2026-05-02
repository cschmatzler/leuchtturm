import { Context } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import { Errors } from "@leuchtturm/api/errors";
import { SessionSelect, UserSelect } from "@leuchtturm/core/auth/schema";

export namespace AuthMiddleware {
	export interface CurrentUserShape {
		readonly user: typeof UserSelect.Type;
		readonly session: typeof SessionSelect.Type;
	}

	export class CurrentUser extends Context.Service<CurrentUser, CurrentUserShape>()(
		"CurrentUser",
	) {}

	export class Service extends HttpApiMiddleware.Service<Service, { provides: CurrentUser }>()(
		"AuthMiddleware",
		{ error: Errors },
	) {}
}
