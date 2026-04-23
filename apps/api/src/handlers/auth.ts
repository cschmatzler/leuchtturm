import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Auth } from "@leuchtturm/core/auth";
import { AuthError } from "@leuchtturm/core/auth/errors";

export namespace AuthHandler {
	export const handlePassthrough = Effect.fn("auth.passthrough.handle")(function* (
		auth: Auth.Interface,
		request: HttpServerRequest.HttpServerRequest,
	) {
		return yield* auth.handle(request.source as Request).pipe(
			Effect.catch(() =>
				Effect.fail(
					new AuthError({
						message: "Auth passthrough failed",
					}),
				),
			),
			Effect.map(HttpServerResponse.fromWeb),
		);
	});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "auth", (handlers) =>
		handlers
			.handleRaw("authGet", ({ request }) =>
				Effect.gen(function* () {
					return yield* handlePassthrough(yield* Auth.Service, request);
				}),
			)
			.handleRaw("authPost", ({ request }) =>
				Effect.gen(function* () {
					return yield* handlePassthrough(yield* Auth.Service, request);
				}),
			),
	);
}
