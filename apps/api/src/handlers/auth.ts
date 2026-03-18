import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { auth } from "@chevrotain/core/auth/index";
import { UnauthorizedError } from "@chevrotain/core/errors";

/** Passthrough handler that forwards requests to better-auth. */
const passthrough = Effect.fn("auth.passthrough")(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
	const response = yield* Effect.tryPromise({
		try: () => auth.handler(rawRequest),
		catch: () => new UnauthorizedError({ message: "Auth service error" }),
	});
	return HttpServerResponse.fromWeb(response);
});

export const AuthHandlerLive = HttpApiBuilder.group(ChevrotainApi, "auth", (handlers) =>
	handlers.handleRaw("authGet", passthrough).handleRaw("authPost", passthrough),
);
