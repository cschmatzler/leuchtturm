import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import { handleAuthPassthrough } from "@chevrotain/api/handlers/auth";
import { applyHttpAuth } from "@chevrotain/api/middleware/auth-live";
import { Auth } from "@chevrotain/core/auth/index";

const TEST_SESSION: Auth.SessionData = {
	user: {
		id: "usr_01ARZ3NDEKTSV4RRFFQ69G5FAV" as never,
		name: "Test User",
		email: "test@example.com" as never,
		image: null,
		language: "en",
		emailVerified: true,
		createdAt: new Date("2024-01-01T00:00:00.000Z"),
		updatedAt: new Date("2024-01-01T00:00:00.000Z"),
	},
	session: {
		id: "ses_01ARZ3NDEKTSV4RRFFQ69G5FAV" as never,
		token: "session-token",
		ipAddress: "127.0.0.1",
		userAgent: "vitest",
		expiresAt: new Date("2026-01-01T00:00:00.000Z"),
		userId: "usr_01ARZ3NDEKTSV4RRFFQ69G5FAV" as never,
		createdAt: new Date("2024-01-01T00:00:00.000Z"),
		updatedAt: new Date("2024-01-01T00:00:00.000Z"),
	},
};

const AuthMock: Auth.Interface = {
	handle: (request) => {
		switch (request.headers.get("x-auth-mode")) {
			case "error":
				return Effect.fail(
					new Auth.AuthError({
						message: "auth backend unavailable",
					}),
				);
			case "body-error":
				return Effect.succeed(
					new Response(
						new ReadableStream({
							start(controller) {
								controller.error(new Error("body stream failed"));
							},
						}),
						{
							headers: { "content-type": "text/plain" },
							status: 200,
						},
					),
				);
			default:
				return Effect.succeed(
					new Response("ok", {
						headers: { "content-type": "text/plain" },
						status: 200,
					}),
				);
		}
	},
	getSession: (headers) => {
		switch (headers.get("x-session-mode")) {
			case "error":
				return Effect.fail(
					new Auth.AuthError({
						message: "session store unavailable",
					}),
				);
			case "missing":
				return Effect.succeed(null);
			default:
				return Effect.succeed(TEST_SESSION);
		}
	},
};

const okResponse = Effect.succeed(HttpServerResponse.text("ok"));

async function runResponse(
	effect: Effect.Effect<HttpServerResponse.HttpServerResponse, never, never>,
) {
	const response = await Effect.runPromise(effect);
	return HttpServerResponse.toWeb(response);
}

describe("auth handlers", () => {
	it("returns 500 when protected routes hit an auth backend failure", async () => {
		const request = HttpServerRequest.fromWeb(
			new Request("http://example.com/api/query", {
				headers: { "x-session-mode": "error" },
				method: "POST",
			}),
		);

		const response = await runResponse(applyHttpAuth(AuthMock, request, okResponse));

		expect(response.status).toBe(500);
		expect(await response.text()).toContain("AuthServiceError");
	});

	it("keeps 401 for genuinely unauthenticated protected-route requests", async () => {
		const request = HttpServerRequest.fromWeb(
			new Request("http://example.com/api/query", {
				headers: { "x-session-mode": "missing" },
				method: "POST",
			}),
		);

		const response = await runResponse(applyHttpAuth(AuthMock, request, okResponse));

		expect(response.status).toBe(401);
		expect(await response.text()).toContain("UnauthorizedError");
	});

	it("returns 500 when the auth passthrough handler fails internally", async () => {
		const request = HttpServerRequest.fromWeb(
			new Request("http://example.com/api/auth/test", {
				headers: { "x-auth-mode": "error" },
			}),
		);

		const response = await runResponse(handleAuthPassthrough(AuthMock, request));

		expect(response.status).toBe(500);
		expect(await response.text()).toContain("AuthServiceError");
	});

	it("returns 500 when the auth passthrough response body cannot be read", async () => {
		const request = HttpServerRequest.fromWeb(
			new Request("http://example.com/api/auth/test", {
				headers: { "x-auth-mode": "body-error" },
			}),
		);

		const response = await runResponse(handleAuthPassthrough(AuthMock, request));

		expect(response.status).toBe(500);
		expect(await response.text()).toContain("AuthServiceError");
	});
});
