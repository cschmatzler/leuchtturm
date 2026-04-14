import { Effect } from "effect";
import { Cookies, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Auth } from "@leuchtturm/core/auth";

export namespace AuthHandler {
	export const handlePassthrough = Effect.fn("auth.passthrough.handle")(function* (
		auth: Auth.Interface,
		request: HttpServerRequest.HttpServerRequest,
	) {
		return yield* auth.handle(request.source as Request).pipe(
			Effect.mapError(
				(error) =>
					new Auth.AuthError({
						message: `Auth passthrough failed: ${error.message}`,
					}),
			),
			Effect.flatMap((response) =>
				Effect.tryPromise({
					try: () => response.arrayBuffer(),
					catch: (error) =>
						new Auth.AuthError({
							message: `Failed to read auth response body: ${error instanceof Error ? error.message : String(error)}`,
						}),
				}).pipe(
					Effect.map((body) => {
						const headers = new Headers(response.headers);
						const cookies = Cookies.fromSetCookie(headers.getSetCookie());
						headers.delete("set-cookie");

						return HttpServerResponse.raw(new Uint8Array(body), {
							status: response.status,
							headers,
							cookies,
						});
					}),
				),
			),
			Effect.match({
				onFailure: (error) => HttpServerResponse.jsonUnsafe(error, { status: 500 }),
				onSuccess: (response) => response,
			}),
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
