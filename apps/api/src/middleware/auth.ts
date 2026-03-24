import { Schema, ServiceMap } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import type { Session, User } from "@chevrotain/core/auth/schema";
import { AuthServiceError, UnauthorizedError } from "@chevrotain/core/errors";

export interface CurrentUserShape {
	readonly user: User;
	readonly session: Session;
}

export class CurrentUser extends ServiceMap.Service<CurrentUser, CurrentUserShape>()(
	"CurrentUser",
) {}

const AuthMiddlewareError = Schema.Union([UnauthorizedError, AuthServiceError]);

export class AuthMiddleware extends HttpApiMiddleware.Service<
	AuthMiddleware,
	{ provides: CurrentUser }
>()("AuthMiddleware", { error: AuthMiddlewareError }) {}
