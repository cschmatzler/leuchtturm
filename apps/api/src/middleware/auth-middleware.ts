import { Effect, Layer } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { AuthMiddleware, CurrentUser } from "@chevrotain/api/middleware/auth";
import { Auth } from "@chevrotain/core/auth";
import { AuthServiceError } from "@chevrotain/core/errors";

export { AuthMiddleware, CurrentUser };

const authHttpErrorResponse = (status: 401 | 500, tag: string, message: string) =>
	HttpServerResponse.jsonUnsafe({ _tag: tag, message }, { status });

const runHttpAuth = Effect.fn("auth.middleware.run")(function* <E, R>(
	auth: Auth.Interface,
	request: HttpServerRequest.HttpServerRequest,
	httpApp: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) {
	// Pass headers directly instead of calling toWeb(), which would create a
	// ReadableStream from the request body and prevent downstream handlers
	// (e.g. Zero) from reading it.
	const currentUser = yield* auth
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
		);

	if (!currentUser) {
		yield* Effect.logWarning("Auth middleware rejected unauthenticated request");
		return authHttpErrorResponse(401, "UnauthorizedError", "Unauthorized");
	}

	return yield* httpApp.pipe(Effect.provideService(CurrentUser, currentUser));
});

export const applyHttpAuth = Effect.fn("auth.middleware.http")(function* <E, R>(
	auth: Auth.Interface,
	request: HttpServerRequest.HttpServerRequest,
	httpApp: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) {
	return yield* runHttpAuth(auth, request, httpApp).pipe(
		Effect.catchIf(
			(error) => error instanceof AuthServiceError,
			(error) => Effect.succeed(authHttpErrorResponse(500, error._tag, error.message)),
		),
	);
});

export const authMiddlewareLayer = Layer.effect(AuthMiddleware)(
	Effect.gen(function* () {
		const auth = yield* Auth.Service;

		return (httpApp, _options) =>
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				return yield* applyHttpAuth(auth, request, httpApp);
			});
	}),
);
