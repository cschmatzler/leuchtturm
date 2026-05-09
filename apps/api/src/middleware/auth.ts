import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";

import { Errors } from "@leuchtturm/api/errors";
import { Auth } from "@leuchtturm/core/auth";
import { SessionSelect, UserSelect } from "@leuchtturm/core/auth/schema";
import { UnauthorizedError } from "@leuchtturm/core/errors";

export namespace AuthMiddleware {
	export interface CurrentUserShape {
		readonly user: typeof UserSelect.Type;
		readonly session: typeof SessionSelect.Type;
	}

	export class CurrentUser extends Context.Service<CurrentUser, CurrentUserShape>()(
		"@leuchtturm/AuthMiddleware/CurrentUser",
	) {}

	export class Service extends HttpApiMiddleware.Service<Service, { provides: CurrentUser }>()(
		"@leuchtturm/AuthMiddleware",
		{ error: Errors },
	) {}

	const run = Effect.fn("AuthMiddleware.run")(function* <E, R>(
		auth: Auth.Interface,
		request: HttpServerRequest.HttpServerRequest,
		httpApp: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
	) {
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

	export const layer = Layer.effect(Service)(
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
