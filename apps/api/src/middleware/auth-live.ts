import { Effect, Layer } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { AuthMiddleware, CurrentUser, RpcAuthMiddleware } from "@chevrotain/api/middleware/auth";
import { Auth } from "@chevrotain/core/auth/index";
import { AuthServiceError, UnauthorizedError } from "@chevrotain/core/errors";

export { AuthMiddleware, CurrentUser, RpcAuthMiddleware };

const authHttpErrorResponse = (status: 401 | 500, tag: string, message: string) =>
	HttpServerResponse.jsonUnsafe({ _tag: tag, message }, { status });

export const applyHttpAuth = Effect.fn("auth.middleware.http")(function* <E, R>(
	auth: Auth.Interface,
	request: HttpServerRequest.HttpServerRequest,
	httpApp: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) {
	// Pass headers directly instead of calling toWeb(), which would create a
	// ReadableStream from the request body and prevent downstream handlers
	// (e.g. Zero) from reading it.
	const currentUserResult = yield* auth
		.getSession(new Headers(request.headers as Record<string, string>))
		.pipe(
			Effect.mapError(
				(error) =>
					new AuthServiceError({
						message: `Auth session lookup failed: ${error.message}`,
					}),
			),
			Effect.withSpan("auth.session.lookup", {
				attributes: { "auth.flow": "http" },
			}),
			Effect.match({
				onFailure: (error) => ({ _tag: "error" as const, error }),
				onSuccess: (currentUser) => ({ _tag: "success" as const, currentUser }),
			}),
		);

	if (currentUserResult._tag === "error") {
		return authHttpErrorResponse(
			500,
			currentUserResult.error._tag,
			currentUserResult.error.message,
		);
	}

	const currentUser = currentUserResult.currentUser;
	if (!currentUser) {
		yield* Effect.logWarning("Auth middleware rejected unauthenticated request");
		return authHttpErrorResponse(401, "UnauthorizedError", "Unauthorized");
	}

	yield* Effect.annotateCurrentSpan({
		"auth.authenticated": true,
		"enduser.id": currentUser.user.id,
	});

	return yield* httpApp.pipe(Effect.provideService(CurrentUser, currentUser));
});

export const AuthMiddlewareLive = Layer.effect(AuthMiddleware)(
	Effect.gen(function* () {
		const auth = yield* Auth.Service;

		return (httpApp, _options) =>
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				return yield* applyHttpAuth(auth, request, httpApp);
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
					.getSession(new Headers(request.headers as Record<string, string>))
					.pipe(
						Effect.mapError(
							(error) =>
								new AuthServiceError({
									message: `RPC auth session lookup failed: ${error.message}`,
								}),
						),
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
