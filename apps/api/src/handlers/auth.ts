import { Effect } from "effect";
import { Cookies, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { reportApiError } from "@chevrotain/api/analytics/report-error";
import { ChevrotainApi } from "@chevrotain/api/contract";
import { recordAuthRequest, routeLabelFromUrl } from "@chevrotain/api/metrics";
import { Analytics } from "@chevrotain/core/analytics/index";
import { Auth } from "@chevrotain/core/auth/index";
import { AuthServiceError } from "@chevrotain/core/errors";

const authPassthroughErrorResponse = (message: string) =>
	HttpServerResponse.jsonUnsafe({ _tag: "AuthServiceError", message }, { status: 500 });

function recordAuthPassthroughOutcome(outcome: "ok" | "error", startedAt: number): void {
	recordAuthRequest("passthrough", outcome, (performance.now() - startedAt) / 1000);
}

export const handleAuthPassthrough = Effect.fn("auth.passthrough.handle")(function* (
	auth: Auth.Interface,
	request: HttpServerRequest.HttpServerRequest,
	analytics: Analytics.Interface | null = null,
) {
	const startedAt = performance.now();
	const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
	const route = routeLabelFromUrl(request.url);

	const responseResult = yield* auth.handle(rawRequest).pipe(
		Effect.mapError(
			(error) =>
				new AuthServiceError({
					message: `Auth passthrough failed: ${error.message}`,
				}),
		),
		Effect.withSpan("auth.handler", {
			attributes: { "http.route": route },
		}),
		Effect.tapError((error) =>
			Effect.logError("Auth handler failed").pipe(Effect.annotateLogs("error", error.message)),
		),
		Effect.match({
			onFailure: (error) => ({ _tag: "error" as const, error }),
			onSuccess: (response) => ({ _tag: "success" as const, response }),
		}),
	);

	if (responseResult._tag === "error") {
		recordAuthPassthroughOutcome("error", startedAt);
		yield* reportApiError(analytics, {
			request,
			statusCode: 500,
			error: responseResult.error,
		});

		return authPassthroughErrorResponse(responseResult.error.message);
	}

	const response = responseResult.response;

	// HttpServerResponse.fromWeb() converts the body to a stream and drops the
	// content-type (defaults to application/octet-stream). Read the body eagerly
	// and construct the response with the correct content-type preserved.
	const bodyResult = yield* Effect.tryPromise({
		try: () => response.arrayBuffer(),
		catch: (error) =>
			new AuthServiceError({
				message: `Failed to read auth response body: ${error instanceof Error ? error.message : String(error)}`,
			}),
	}).pipe(
		Effect.withSpan("auth.response.readBody", {
			attributes: { "http.route": route },
		}),
		Effect.match({
			onFailure: (error) => ({ _tag: "error" as const, error }),
			onSuccess: (body) => ({ _tag: "success" as const, body }),
		}),
	);

	if (bodyResult._tag === "error") {
		recordAuthPassthroughOutcome("error", startedAt);
		yield* reportApiError(analytics, {
			request,
			statusCode: 500,
			error: bodyResult.error,
		});

		return authPassthroughErrorResponse(bodyResult.error.message);
	}

	const body = bodyResult.body;
	const headers = new Headers(response.headers);
	const setCookieHeaders = headers.getSetCookie();
	headers.delete("set-cookie");
	recordAuthPassthroughOutcome("ok", startedAt);

	return HttpServerResponse.raw(new Uint8Array(body), {
		status: response.status,
		headers,
		contentType: response.headers.get("content-type") ?? undefined,
		cookies: Cookies.fromSetCookie(setCookieHeaders),
	});
});

const passthrough = Effect.fn("auth.passthrough")(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const analytics = yield* Analytics.Service;
	const auth = yield* Auth.Service;

	return yield* handleAuthPassthrough(auth, request, analytics);
});

export const AuthHandlerLive = HttpApiBuilder.group(ChevrotainApi, "auth", (handlers) =>
	handlers.handleRaw("authGet", passthrough).handleRaw("authPost", passthrough),
);
