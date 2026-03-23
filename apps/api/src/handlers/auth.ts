import { Effect } from "effect";
import { Cookies, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { routeLabelFromUrl } from "@chevrotain/api/metrics";
import { Auth } from "@chevrotain/core/auth/index";
import { UnauthorizedError } from "@chevrotain/core/errors";

const passthrough = Effect.fn("auth.passthrough")(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const auth = yield* Auth.Service;
	const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
	const route = routeLabelFromUrl(request.url);

	const response = yield* auth.handle(rawRequest).pipe(
		Effect.mapError((error) => new UnauthorizedError({ message: error.message })),
		Effect.withSpan("auth.handler", {
			attributes: { "http.route": route },
		}),
		Effect.tapError(() => Effect.logError("Auth handler failed")),
	);

	// HttpServerResponse.fromWeb() converts the body to a stream and drops the
	// content-type (defaults to application/octet-stream). Read the body eagerly
	// and construct the response with the correct content-type preserved.
	const body = yield* Effect.tryPromise({
		try: () => response.arrayBuffer(),
		catch: (error) =>
			new UnauthorizedError({
				message: `Failed to read auth response body: ${error instanceof Error ? error.message : String(error)}`,
			}),
	}).pipe(
		Effect.withSpan("auth.response.readBody", {
			attributes: { "http.route": route },
		}),
	);

	const headers = new Headers(response.headers);
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
