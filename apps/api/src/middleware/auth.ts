import { Effect, Layer, ServiceMap } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

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

/** Auth middleware tag — provides CurrentUser or fails with UnauthorizedError. */
export class AuthMiddleware extends HttpApiMiddleware.Service<
	AuthMiddleware,
	{ provides: CurrentUser }
>()("AuthMiddleware", { error: UnauthorizedError }) {}

/**
 * Auth middleware implementation.
 *
 * Wraps the downstream httpApp, authenticates via better-auth, and provides
 * CurrentUser to the downstream handler.
 */
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
