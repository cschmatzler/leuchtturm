import { Effect, Layer, ServiceMap } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiMiddleware } from "effect/unstable/httpapi";
import { RpcMiddleware } from "effect/unstable/rpc";

import { auth } from "@chevrotain/core/auth/index";
import { UnauthorizedError } from "@chevrotain/core/errors";

type Session = typeof auth.$Infer.Session;

export interface CurrentUserShape {
	readonly user: Session["user"];
	readonly session: Session["session"];
}

/** Context tag provided to handlers after successful authentication. */
export class CurrentUser extends ServiceMap.Service<CurrentUser, CurrentUserShape>()(
	"CurrentUser",
) {}

// --- HttpApi middleware ---

/** HttpApi auth middleware — provides CurrentUser or fails with UnauthorizedError. */
export class AuthMiddleware extends HttpApiMiddleware.Service<
	AuthMiddleware,
	{ provides: CurrentUser }
>()("AuthMiddleware", { error: UnauthorizedError }) {}

export const AuthMiddlewareLive = Layer.succeed(AuthMiddleware, (httpApp, _options) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
		const session = yield* Effect.tryPromise({
			try: () => auth.api.getSession({ headers: rawRequest.headers }),
			catch: () => new UnauthorizedError({ message: "Auth check failed" }),
		});
		if (!session) {
			yield* Effect.logWarning("Auth middleware rejected unauthenticated request");
			return yield* new UnauthorizedError({ message: "Unauthorized" });
		}
		return yield* httpApp.pipe(
			Effect.provideService(CurrentUser, {
				user: session.user,
				session: session.session,
			}),
		);
	}),
);

// --- RPC middleware ---

/** RPC auth middleware — provides CurrentUser or fails with UnauthorizedError. */
export class RpcAuthMiddleware extends RpcMiddleware.Service<
	RpcAuthMiddleware,
	{ provides: CurrentUser; requires: HttpServerRequest.HttpServerRequest }
>()("RpcAuthMiddleware", {
	error: UnauthorizedError,
	requiredForClient: false,
}) {}

/**
 * RPC auth middleware implementation.
 *
 * The RPC server runs within an HTTP request context, so HttpServerRequest
 * is available. We extract session cookies from the raw request and validate
 * via better-auth, then provide CurrentUser to the downstream handler.
 */
export const RpcAuthMiddlewareLive = Layer.succeed(RpcAuthMiddleware, (effect, _options) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
		const session = yield* Effect.tryPromise({
			try: () => auth.api.getSession({ headers: rawRequest.headers }),
			catch: () => new UnauthorizedError({ message: "Auth check failed" }),
		});
		if (!session) {
			yield* Effect.logWarning("RPC auth middleware rejected unauthenticated request");
			return yield* new UnauthorizedError({ message: "Unauthorized" });
		}
		return yield* effect.pipe(
			Effect.provideService(CurrentUser, {
				user: session.user,
				session: session.session,
			}),
		);
	}),
);
