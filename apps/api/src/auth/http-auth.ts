import { Schema, ServiceMap } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import { Auth } from "@leuchtturm/core/auth";
import type { Session, User } from "@leuchtturm/core/auth/schema";
import { UnauthorizedError } from "@leuchtturm/core/errors";

export namespace AuthMiddleware {
	export interface CurrentUserShape {
		readonly user: User;
		readonly session: Session;
	}

	export class CurrentUser extends ServiceMap.Service<CurrentUser, CurrentUserShape>()(
		"CurrentUser",
	) {}

	const MiddlewareError = Schema.Union([UnauthorizedError, Auth.AuthError]);

	export class Service extends HttpApiMiddleware.Service<Service, { provides: CurrentUser }>()(
		"AuthMiddleware",
		{ error: MiddlewareError },
	) {}
}
