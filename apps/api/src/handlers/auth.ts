import { Effect } from "effect";
import { Cookies, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { auth } from "@chevrotain/core/auth/index";
import { UnauthorizedError } from "@chevrotain/core/errors";

const passthrough = Effect.fn("auth.passthrough")(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);

	const response = yield* Effect.tryPromise({
		try: () => auth.handler(rawRequest),
		catch: () => new UnauthorizedError({ message: "Auth service error" }),
	}).pipe(Effect.tapError(() => Effect.logError("Auth handler failed")));

	// HttpServerResponse.fromWeb() converts the body to a stream and drops the
	// content-type (defaults to application/octet-stream). Read the body eagerly
	// and construct the response with the correct content-type preserved.
	const body = yield* Effect.tryPromise({
		try: () => response.arrayBuffer(),
		catch: () => new UnauthorizedError({ message: "Failed to read auth response body" }),
	});

	const headers = new globalThis.Headers(response.headers);
	const setCookieHeaders = headers.getSetCookie();
	headers.delete("set-cookie");

	return HttpServerResponse.raw(new Uint8Array(body), {
		status: response.status,
		headers,
		contentType: response.headers.get("content-type") ?? undefined,
		cookies: Cookies.fromSetCookie(setCookieHeaders),
	});
});

export const AuthHandlerLive = HttpApiBuilder.group(ChevrotainApi, "auth", (handlers) =>
	handlers.handleRaw("authGet", passthrough).handleRaw("authPost", passthrough),
);
