import * as Context from "effect/Context";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";

import { Errors } from "@leuchtturm/api/error-catalog";
import { SessionSelect, UserSelect } from "@leuchtturm/core/auth/schema";

export namespace Session {
	export interface Interface {
		readonly user: typeof UserSelect.Type;
		readonly session: typeof SessionSelect.Type;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/api/Session") {}

	export class Middleware extends HttpApiMiddleware.Service<Middleware, { provides: Service }>()(
		"@leuchtturm/api/SessionMiddleware",
		{ error: Errors },
	) {}
}
