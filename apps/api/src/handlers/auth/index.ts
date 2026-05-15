import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import type { Contract } from "@leuchtturm/api/contract";
import { Observability } from "@leuchtturm/api/observability";
import { Auth } from "@leuchtturm/core/auth";
import { AuthError, AuthHandlerError } from "@leuchtturm/core/auth/errors";

export namespace AuthHandler {
	export const handlePassthrough = Effect.fn("AuthHandler.handlePassthrough")(function* (
		request: HttpServerRequest.HttpServerRequest,
	) {
		const auth = yield* Auth.Service;
		const source = request.source as Request;

		return yield* auth.handle(source).pipe(
			Effect.tap((response) =>
				Effect.annotateCurrentSpan({ "http.response.status_code": response.status }),
			),
			Effect.map(HttpServerResponse.fromWeb),
			Effect.catchCause((cause) => {
				for (const reason of cause.reasons) {
					if (Cause.isFailReason(reason) && Schema.is(AuthError)(reason.error)) {
						return Effect.fail(reason.error);
					}
				}

				return Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }).pipe(
					Effect.andThen(Effect.fail(AuthHandlerError.new())),
				);
			}),
		);
	});

	export const layer = (api: Contract.Api) =>
		HttpApiBuilder.group(api, "auth", (handlers) =>
			handlers
				.handleRaw("authGet", ({ request }) =>
					handlePassthrough(request).pipe(
						Effect.tap(() => Observability.recordAction("auth.passthrough", "success")),
						Effect.tapCause(() => Observability.recordAction("auth.passthrough", "failure")),
					),
				)
				.handleRaw("authPost", ({ request }) =>
					handlePassthrough(request).pipe(
						Effect.tap(() => Observability.recordAction("auth.passthrough", "success")),
						Effect.tapCause(() => Observability.recordAction("auth.passthrough", "failure")),
					),
				),
		);
}
