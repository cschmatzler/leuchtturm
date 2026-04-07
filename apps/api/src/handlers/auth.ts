import { Effect } from "effect";
import { Cookies, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { Auth } from "@chevrotain/core/auth";
import { AuthServiceError } from "@chevrotain/core/errors";

const authPassthroughErrorResponse = (message: string) =>
	HttpServerResponse.jsonUnsafe({ _tag: "AuthServiceError", message }, { status: 500 });

const runAuthPassthrough = Effect.fn("auth.passthrough.run")(function* (
	auth: Auth.Interface,
	request: HttpServerRequest.HttpServerRequest,
) {
	const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);

	const response = yield* auth.handle(rawRequest).pipe(
		Effect.mapError(
			(error) =>
				new AuthServiceError({
					message: `Auth passthrough failed: ${error.message}`,
				}),
		),
	);

	// HttpServerResponse.fromWeb() converts the body to a stream and drops the
	// content-type (defaults to application/octet-stream). Read the body eagerly
	// and construct the response with the correct content-type preserved.
	const body = yield* Effect.tryPromise({
		try: () => response.arrayBuffer(),
		catch: (error) =>
			new AuthServiceError({
				message: `Failed to read auth response body: ${error instanceof Error ? error.message : String(error)}`,
			}),
	});
	const headers = new Headers(response.headers);
	const setCookieHeaders = headers.has("set-cookie") ? [headers.get("set-cookie")!] : [];
	headers.delete("set-cookie");

	return HttpServerResponse.raw(new Uint8Array(body), {
		status: response.status,
		headers,
		contentType: response.headers.get("content-type") ?? undefined,
		cookies: Cookies.fromSetCookie(setCookieHeaders),
	});
});

export const handleAuthPassthrough = Effect.fn("auth.passthrough.handle")(function* (
	auth: Auth.Interface,
	request: HttpServerRequest.HttpServerRequest,
) {
	return yield* runAuthPassthrough(auth, request).pipe(
		Effect.catch((error) => Effect.succeed(authPassthroughErrorResponse(error.message))),
	);
});

const passthrough = Effect.fn("auth.passthrough")(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const auth = yield* Auth.Service;

	return yield* handleAuthPassthrough(auth, request);
});

export const AuthHandler = HttpApiBuilder.group(ChevrotainApi, "auth", (handlers) =>
	handlers.handleRaw("authGet", passthrough).handleRaw("authPost", passthrough),
);
