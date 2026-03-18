import { Effect, Option } from "effect";
import { HttpMethod, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { auth } from "@chevrotain/core/auth/index";
import { UnauthorizedError } from "@chevrotain/core/errors";

/** Passthrough handler that forwards requests to better-auth.
 *
 * Buffers the request body before constructing the Web Request so that
 * `Stream.toReadableStreamRuntime` stream-forwarding issues don't cause
 * Better Auth to receive an empty body.
 */
const passthrough = Effect.fn("auth.passthrough")(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const url = HttpServerRequest.toURL(request);
	if (Option.isNone(url)) {
		return yield* Effect.fail(new UnauthorizedError({ message: "Invalid request URL" }));
	}

	const init: RequestInit = {
		method: request.method,
		headers: request.headers,
	};

	if (HttpMethod.hasBody(request.method)) {
		init.body = yield* request.arrayBuffer.pipe(Effect.orDie);
	}

	const webRequest = new Request(url.value, init);
	const response = yield* Effect.tryPromise({
		try: () => auth.handler(webRequest),
		catch: () => new UnauthorizedError({ message: "Auth service error" }),
	}).pipe(Effect.tapError(() => Effect.logError("Auth handler failed")));
	return HttpServerResponse.fromWeb(response);
});

export const AuthHandlerLive = HttpApiBuilder.group(ChevrotainApi, "auth", (handlers) =>
	handlers.handleRaw("authGet", passthrough).handleRaw("authPost", passthrough),
);
