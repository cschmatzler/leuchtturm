import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import { AuthMiddleware, CurrentUser, RpcAuthMiddleware } from "@chevrotain/api/middleware/auth";
import { auth } from "@chevrotain/core/auth/index";
import { UnauthorizedError } from "@chevrotain/core/errors";

export { AuthMiddleware, CurrentUser, RpcAuthMiddleware };

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
