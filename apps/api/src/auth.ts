import * as Context from "effect/Context";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";

import { Errors } from "@leuchtturm/api/errors";
import { SessionSelect, UserSelect } from "@leuchtturm/core/auth/schema";

export namespace Auth {
	export interface Interface {
		readonly user: typeof UserSelect.Type;
		readonly session: typeof SessionSelect.Type;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/api/Auth") {}

	export class Middleware extends HttpApiMiddleware.Service<Middleware, { provides: Service }>()(
		"@leuchtturm/api/AuthMiddleware",
		{ error: Errors },
	) {}
}
