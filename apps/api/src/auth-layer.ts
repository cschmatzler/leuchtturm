import { Effect, Layer } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { AuthMiddleware } from "@leuchtturm/api/auth";
import { Auth } from "@leuchtturm/core/auth";
import { UnauthorizedError } from "@leuchtturm/core/errors";

const run = Effect.fn("AuthMiddleware.run")(function* <E, R>(
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
			Effect.withSpan("auth.session.lookup", {
				attributes: { "auth.flow": "http" },
			}),
		);

	if (!currentUser) {
		return yield* Effect.fail(new UnauthorizedError({ message: "Unauthorized" }));
	}

	return yield* httpApp.pipe(Effect.provideService(AuthMiddleware.CurrentUser, currentUser));
});

export namespace AuthMiddlewareLayer {
	export const layer = Layer.effect(AuthMiddleware.Service)(
		Effect.gen(function* () {
			const auth = yield* Auth.Service;

			return (httpApp, _options) =>
				Effect.gen(function* () {
					const request = yield* HttpServerRequest.HttpServerRequest;
					return yield* run(auth, request, httpApp);
				});
		}),
	);
}
