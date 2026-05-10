import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { AuthMiddleware as AuthMiddlewareService, CurrentUser } from "@leuchtturm/api/contract";
import { Auth } from "@leuchtturm/core/auth";
import { UnauthorizedError } from "@leuchtturm/core/errors";

export namespace AuthMiddleware {
	const run = Effect.fn("AuthMiddleware.run")(function* <E, R>(
		auth: Auth.Interface,
		httpApp: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
	) {
		const request = yield* HttpServerRequest.HttpServerRequest;

		// Pass headers directly instead of calling toWeb(), which would create a
		// ReadableStream from the request body and prevent downstream handlers
		// (e.g. Zero) from reading it.
		const currentUser = yield* auth.getSession(new Headers(request.headers)).pipe(
			Effect.withSpan("auth.session.lookup", {
				attributes: { "auth.flow": "http" },
			}),
		);

		if (!currentUser) {
			return yield* Effect.fail(new UnauthorizedError());
		}

		return yield* httpApp.pipe(Effect.provideService(CurrentUser, currentUser));
	});

	export const layer = Layer.effect(AuthMiddlewareService)(
		Effect.gen(function* () {
			const auth = yield* Auth.Service;

			return (httpApp, _options) => run(auth, httpApp);
		}),
	);
}
