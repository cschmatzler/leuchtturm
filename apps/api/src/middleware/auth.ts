import { ServiceMap } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";
import { HttpApiMiddleware } from "effect/unstable/httpapi";
import { RpcMiddleware } from "effect/unstable/rpc";

import type { Session, User } from "@chevrotain/core/auth/schema";
import { UnauthorizedError } from "@chevrotain/core/errors";

export interface CurrentUserShape {
	readonly user: User;
	readonly session: Session;
}

export class CurrentUser extends ServiceMap.Service<CurrentUser, CurrentUserShape>()(
	"CurrentUser",
) {}

export class AuthMiddleware extends HttpApiMiddleware.Service<
	AuthMiddleware,
	{ provides: CurrentUser }
>()("AuthMiddleware", { error: UnauthorizedError }) {}

export class RpcAuthMiddleware extends RpcMiddleware.Service<
	RpcAuthMiddleware,
	{ provides: CurrentUser; requires: HttpServerRequest.HttpServerRequest }
>()("RpcAuthMiddleware", {
	error: UnauthorizedError,
	requiredForClient: false,
}) {}
