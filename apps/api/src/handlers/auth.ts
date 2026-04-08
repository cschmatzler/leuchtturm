import { Effect } from "effect";
import { Cookies, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Auth } from "@leuchtturm/core/auth";
import { AuthServiceError } from "@leuchtturm/core/errors";

export namespace AuthHandler {
	const errorResponse = (message: string) =>
		HttpServerResponse.jsonUnsafe({ _tag: "AuthServiceError", message }, { status: 500 });

	export const handlePassthrough = Effect.fn("auth.passthrough.handle")(function* (
		auth: Auth.Interface,
		request: HttpServerRequest.HttpServerRequest,
	) {
		if (!(request.source instanceof Request)) {
			return errorResponse("Auth passthrough requires a source Request");
		}

		return yield* auth.handle(request.source).pipe(
			Effect.mapError(
				(error) =>
					new AuthServiceError({
						message: `Auth passthrough failed: ${error.message}`,
					}),
			),
			Effect.flatMap((response) =>
				Effect.tryPromise({
					try: () => response.arrayBuffer(),
					catch: (error) =>
						new AuthServiceError({
							message: `Failed to read auth response body: ${error instanceof Error ? error.message : String(error)}`,
						}),
				}).pipe(
					Effect.map((body) => {
						const headers = new Headers(response.headers);
						const setCookieHeaders = headers.has("set-cookie") ? [headers.get("set-cookie")!] : [];
						headers.delete("set-cookie");

						return HttpServerResponse.raw(new Uint8Array(body), {
							status: response.status,
							headers,
							contentType: response.headers.get("content-type") ?? undefined,
							cookies: Cookies.fromSetCookie(setCookieHeaders),
						});
					}),
				),
			),
			Effect.catchIf(
				(error): error is AuthServiceError => error instanceof AuthServiceError,
				(error) => Effect.succeed(errorResponse(error.message)),
			),
		);
	});

	const passthrough = ({ request }: { request: HttpServerRequest.HttpServerRequest }) =>
		Effect.gen(function* () {
			const auth = yield* Auth.Service;

			return yield* handlePassthrough(auth, request);
		});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "auth", (handlers) =>
		handlers.handleRaw("authGet", passthrough).handleRaw("authPost", passthrough),
	);
}
