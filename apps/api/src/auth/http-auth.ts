import { Context, Effect, Layer, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import { Auth } from "@leuchtturm/core/auth";
import { AuthError } from "@leuchtturm/core/auth/errors";
import type { Session, User } from "@leuchtturm/core/auth/schema";
import { UnauthorizedError } from "@leuchtturm/core/errors";

export namespace AuthMiddleware {
	export interface CurrentUserShape {
		readonly user: User;
		readonly session: Session;
	}

	export class CurrentUser extends Context.Service<CurrentUser, CurrentUserShape>()(
		"CurrentUser",
	) {}

	const MiddlewareError = Schema.Union([UnauthorizedError, AuthError]);

	export class Service extends HttpApiMiddleware.Service<Service, { provides: CurrentUser }>()(
		"AuthMiddleware",
		{ error: MiddlewareError },
	) {}

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
				Effect.mapError(
					(error) =>
						new AuthError({
							message: `Auth session lookup failed: ${error.message}`,
						}),
				),
				Effect.withSpan("auth.session.lookup", {
					attributes: { "auth.flow": "http" },
				}),
			);

		if (!currentUser) {
			yield* Effect.logWarning("Auth middleware rejected unauthenticated request");
			return HttpServerResponse.jsonUnsafe(
				{ _tag: "UnauthorizedError", message: "Unauthorized" },
				{ status: 401 },
			);
		}

		return yield* httpApp.pipe(Effect.provideService(CurrentUser, currentUser));
	});

	export const apply = Effect.fn("AuthMiddleware.http")(function* <E, R>(
		auth: Auth.Interface,
		request: HttpServerRequest.HttpServerRequest,
		httpApp: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
	) {
		return yield* run(auth, request, httpApp).pipe(
			Effect.catchIf(Schema.is(AuthError), (error) =>
				Effect.succeed(
					HttpServerResponse.jsonUnsafe(
						{ _tag: error._tag, message: error.message },
						{ status: 500 },
					),
				),
			),
		);
	});

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const auth = yield* Auth.Service;

			return (httpApp, _options) =>
				Effect.gen(function* () {
					const request = yield* HttpServerRequest.HttpServerRequest;
					return yield* apply(auth, request, httpApp);
				});
		}),
	);
}
