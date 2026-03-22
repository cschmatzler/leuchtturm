import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import { AuthMiddleware, CurrentUser, RpcAuthMiddleware } from "@chevrotain/api/middleware/auth";
import { AuthService } from "@chevrotain/core/auth/index";
import { UnauthorizedError } from "@chevrotain/core/errors";

export { AuthMiddleware, CurrentUser, RpcAuthMiddleware };

export const AuthMiddlewareLive = Layer.effect(AuthMiddleware)(
	Effect.gen(function* () {
		const auth = yield* AuthService;

		return (httpApp, _options) =>
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				// Pass headers directly instead of calling toWeb(), which would create a
				// ReadableStream from the request body and prevent downstream handlers
				// (e.g. Zero) from reading it.
				const session = yield* Effect.tryPromise({
					try: () =>
						auth.api.getSession({
							headers: new globalThis.Headers(request.headers as Record<string, string>),
						}),
					catch: (error) =>
						new UnauthorizedError({
							message: `Auth check failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				}).pipe(
					Effect.withSpan("auth.session.lookup", {
						attributes: { "auth.flow": "http" },
					}),
				);
				if (!session) {
					yield* Effect.logWarning("Auth middleware rejected unauthenticated request");
					return yield* new UnauthorizedError({ message: "Unauthorized" });
				}
				yield* Effect.annotateCurrentSpan({
					"auth.authenticated": true,
					"enduser.id": session.user.id,
				});
				return yield* httpApp.pipe(
					Effect.provideService(CurrentUser, {
						user: session.user,
						session: session.session,
					}),
				);
			});
	}),
);

export const RpcAuthMiddlewareLive = Layer.effect(RpcAuthMiddleware)(
	Effect.gen(function* () {
		const auth = yield* AuthService;

		return (effect, _options) =>
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const session = yield* Effect.tryPromise({
					try: () =>
						auth.api.getSession({
							headers: new globalThis.Headers(request.headers as Record<string, string>),
						}),
					catch: (error) =>
						new UnauthorizedError({
							message: `Auth check failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				}).pipe(
					Effect.withSpan("auth.session.lookup", {
						attributes: { "auth.flow": "rpc" },
					}),
				);
				if (!session) {
					yield* Effect.logWarning("RPC auth middleware rejected unauthenticated request");
					return yield* new UnauthorizedError({ message: "Unauthorized" });
				}
				yield* Effect.annotateCurrentSpan({
					"auth.authenticated": true,
					"enduser.id": session.user.id,
				});
				return yield* effect.pipe(
					Effect.provideService(CurrentUser, {
						user: session.user,
						session: session.session,
					}),
				);
			});
	}),
);
