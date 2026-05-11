import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { Auth } from "@leuchtturm/api/auth";
import { Auth as CoreAuth } from "@leuchtturm/core/auth";
import { UnauthorizedError } from "@leuchtturm/core/errors";

export namespace AuthMiddleware {
	const run = Effect.fn("AuthMiddleware.run")(function* <E, R>(
		auth: CoreAuth.Interface,
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

		return yield* httpApp.pipe(Effect.provideService(Auth.Service, currentUser));
	});

	export const layer = Layer.effect(Auth.Middleware)(
		Effect.gen(function* () {
			const auth = yield* CoreAuth.Service;

			return (httpApp, _options) => run(auth, httpApp);
		}),
	);
}
