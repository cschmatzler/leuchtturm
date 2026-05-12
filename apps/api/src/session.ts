import * as Context from "effect/Context";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema";

import { AuthError } from "@leuchtturm/core/auth/errors";
import { SessionSelect, UserSelect } from "@leuchtturm/core/auth/schema";
import { UnauthorizedError } from "@leuchtturm/core/errors";

export namespace Session {
	export interface Interface {
		readonly user: typeof UserSelect.Type;
		readonly session: typeof SessionSelect.Type;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/api/Session") {}

	export class Middleware extends HttpApiMiddleware.Service<Middleware, { provides: Service }>()(
		"@leuchtturm/api/SessionMiddleware",
		{ error: [HttpApiSchema.status(401)(UnauthorizedError), AuthError] },
	) {}
}
