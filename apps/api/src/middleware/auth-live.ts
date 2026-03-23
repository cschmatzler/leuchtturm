import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import { AuthMiddleware, CurrentUser, RpcAuthMiddleware } from "@chevrotain/api/middleware/auth";
import { Auth } from "@chevrotain/core/auth/index";
import { UnauthorizedError } from "@chevrotain/core/errors";

export { AuthMiddleware, CurrentUser, RpcAuthMiddleware };

export const AuthMiddlewareLive = Layer.effect(AuthMiddleware)(
	Effect.gen(function* () {
		const auth = yield* Auth.Service;

		return (httpApp, _options) =>
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				// Pass headers directly instead of calling toWeb(), which would create a
				// ReadableStream from the request body and prevent downstream handlers
				// (e.g. Zero) from reading it.
				const currentUser = yield* auth
					.getSession(new globalThis.Headers(request.headers as Record<string, string>))
					.pipe(
						Effect.mapError((error) => new UnauthorizedError({ message: error.message })),
						Effect.withSpan("auth.session.lookup", {
							attributes: { "auth.flow": "http" },
						}),
					);
				if (!currentUser) {
					yield* Effect.logWarning("Auth middleware rejected unauthenticated request");
					return yield* new UnauthorizedError({ message: "Unauthorized" });
				}
				yield* Effect.annotateCurrentSpan({
					"auth.authenticated": true,
					"enduser.id": currentUser.user.id,
				});
				return yield* httpApp.pipe(Effect.provideService(CurrentUser, currentUser));
			});
	}),
);

export const RpcAuthMiddlewareLive = Layer.effect(RpcAuthMiddleware)(
	Effect.gen(function* () {
		const auth = yield* Auth.Service;

		return (effect, _options) =>
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const currentUser = yield* auth
					.getSession(new globalThis.Headers(request.headers as Record<string, string>))
					.pipe(
						Effect.mapError((error) => new UnauthorizedError({ message: error.message })),
						Effect.withSpan("auth.session.lookup", {
							attributes: { "auth.flow": "rpc" },
						}),
					);
				if (!currentUser) {
					yield* Effect.logWarning("RPC auth middleware rejected unauthenticated request");
					return yield* new UnauthorizedError({ message: "Unauthorized" });
				}
				yield* Effect.annotateCurrentSpan({
					"auth.authenticated": true,
					"enduser.id": currentUser.user.id,
				});
				return yield* effect.pipe(Effect.provideService(CurrentUser, currentUser));
			});
	}),
);
