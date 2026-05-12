import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { Session } from "@leuchtturm/api/session";
import { Auth } from "@leuchtturm/core/auth";
import { InternalServerError, UnauthorizedError } from "@leuchtturm/core/errors";

export namespace AuthMiddleware {
	export const CurrentAuth = Context.Reference<Auth.Interface | null>(
		"@leuchtturm/api/AuthMiddleware/CurrentAuth",
		{ defaultValue: () => null },
	);

	const run = Effect.fn("AuthMiddleware.run")(function* <E, R>(
		httpApp: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
	) {
		const auth = yield* CurrentAuth;
		if (!auth) return yield* Effect.fail(new InternalServerError());
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

		return yield* httpApp.pipe(Effect.provideService(Session.Service, currentUser));
	});

	export const layer = Layer.succeed(Session.Middleware, (httpApp, _options) => run(httpApp));
}
