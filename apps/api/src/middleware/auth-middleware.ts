import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";

import { Session } from "@leuchtturm/api/session";
import { Auth } from "@leuchtturm/core/auth";
import { UnauthorizedError } from "@leuchtturm/core/errors";

export namespace AuthMiddleware {
	export const layer = Layer.effect(Session.Middleware)(
		Effect.gen(function* () {
			const auth = yield* Auth.Service;

			return (httpApp, _options) =>
				Effect.gen(function* () {
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
						return yield* UnauthorizedError.new();
					}

					return yield* httpApp.pipe(Effect.provideService(Session.Service, currentUser));
				});
		}),
	);
}
