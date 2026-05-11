import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Metrics } from "@leuchtturm/api/observability/metrics";
import { Auth } from "@leuchtturm/core/auth";
import { AuthError, AuthHandlerError } from "@leuchtturm/core/auth/errors";

export namespace AuthHandler {
	export const handlePassthrough = Effect.fn("auth.passthrough.handle")(function* (
		request: HttpServerRequest.HttpServerRequest,
	) {
		const auth = yield* Auth.Service;

		return yield* auth.handle(request.source as Request).pipe(
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
			.handleRaw("authGet", ({ request }) =>
				Metrics.trackAction("auth.passthrough", handlePassthrough(request)),
			)
			.handleRaw("authPost", ({ request }) =>
				Metrics.trackAction("auth.passthrough", handlePassthrough(request)),
			),
	);
}
