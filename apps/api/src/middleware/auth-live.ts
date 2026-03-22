import { Effect, Layer, Schema } from "effect";
import { HttpServerRequest } from "effect/unstable/http";

import { AuthMiddleware, CurrentUser, RpcAuthMiddleware } from "@chevrotain/api/middleware/auth";
import { AuthService } from "@chevrotain/core/auth/index";
import { Session, User } from "@chevrotain/core/auth/schema";
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
				const currentUser = yield* Effect.all({
					user: Schema.decodeUnknownEffect(User)(session.user),
					session: Schema.decodeUnknownEffect(Session)(session.session),
				}).pipe(
					Effect.mapError(
						(error) =>
							new UnauthorizedError({
								message: `Invalid auth session payload: ${error.message}`,
							}),
					),
				);
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
				const currentUser = yield* Effect.all({
					user: Schema.decodeUnknownEffect(User)(session.user),
					session: Schema.decodeUnknownEffect(Session)(session.session),
				}).pipe(
					Effect.mapError(
						(error) =>
							new UnauthorizedError({
								message: `Invalid auth session payload: ${error.message}`,
							}),
					),
				);
				yield* Effect.annotateCurrentSpan({
					"auth.authenticated": true,
					"enduser.id": currentUser.user.id,
				});
				return yield* effect.pipe(Effect.provideService(CurrentUser, currentUser));
			});
	}),
);
