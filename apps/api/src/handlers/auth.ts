import { Cause, Effect, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Auth } from "@leuchtturm/core/auth";
import { AuthError, AuthHandlerError } from "@leuchtturm/core/auth/errors";

export namespace AuthHandler {
	export const handlePassthrough = Effect.fn("auth.passthrough.handle")(function* (
		request: HttpServerRequest.HttpServerRequest,
	) {
		const auth = yield* Auth.Service;

		return yield* Effect.tryPromise({
			try: () => auth.client.handler(request.source as Request),
			catch: (cause) => cause,
		}).pipe(
			Effect.map(HttpServerResponse.fromWeb),
			Effect.catchCause((cause) =>
				Effect.gen(function* () {
					for (const reason of cause.reasons) {
						if (Cause.isFailReason(reason) && Schema.is(AuthError)(reason.error)) {
							return yield* Effect.fail(reason.error);
						}
					}

					yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
					return yield* Effect.fail(new AuthHandlerError());
				}),
			),
		);
	});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "auth", (handlers) =>
		handlers
			.handleRaw("authGet", ({ request }) => handlePassthrough(request))
			.handleRaw("authPost", ({ request }) => handlePassthrough(request)),
	);
}
