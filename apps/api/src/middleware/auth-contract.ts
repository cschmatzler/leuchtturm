import * as Context from "effect/Context";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";

import { Errors } from "@leuchtturm/api/errors";
import { SessionSelect, UserSelect } from "@leuchtturm/core/auth/schema";

export namespace AuthMiddleware {
	export interface CurrentUserShape {
		readonly user: typeof UserSelect.Type;
		readonly session: typeof SessionSelect.Type;
	}

	export class CurrentUser extends Context.Service<CurrentUser, CurrentUserShape>()(
		"@leuchtturm/api/AuthMiddleware/CurrentUser",
	) {}

	export class Service extends HttpApiMiddleware.Service<Service, { provides: CurrentUser }>()(
		"@leuchtturm/api/AuthMiddleware",
		{ error: Errors },
	) {}
}
