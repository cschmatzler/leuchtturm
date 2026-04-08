import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import { AuthMiddlewareServer } from "@leuchtturm/api/auth/http-auth-server";
import { AuthHandler } from "@leuchtturm/api/handlers/auth";
import { Auth } from "@leuchtturm/core/auth";

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
			case "read-json":
				return Effect.promise(async () => {
					const payload = (await request.json()) as { email: string };
					return new Response(payload.email, {
						headers: { "content-type": "text/plain" },
						status: 200,
					});
				}) as never;
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
	effect: Effect.Effect<HttpServerResponse.HttpServerResponse, never, unknown>,
) {
	const response = await Effect.runPromise(
		effect as Effect.Effect<HttpServerResponse.HttpServerResponse, never, never>,
	);
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

		const response = await runResponse(AuthMiddlewareServer.apply(AuthMock, request, okResponse));

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

		const response = await runResponse(AuthMiddlewareServer.apply(AuthMock, request, okResponse));

		expect(response.status).toBe(401);
		expect(await response.text()).toContain("UnauthorizedError");
	});

	it("returns 500 when the auth passthrough handler fails internally", async () => {
		const request = HttpServerRequest.fromWeb(
			new Request("http://example.com/api/auth/test", {
				headers: { "x-auth-mode": "error" },
			}),
		);

		const response = await runResponse(AuthHandler.handlePassthrough(AuthMock, request));

		expect(response.status).toBe(500);
		expect(await response.text()).toContain("AuthServiceError");
	});

	it("returns 500 when the auth passthrough response body cannot be read", async () => {
		const request = HttpServerRequest.fromWeb(
			new Request("http://example.com/api/auth/test", {
				headers: { "x-auth-mode": "body-error" },
			}),
		);

		const response = await runResponse(AuthHandler.handlePassthrough(AuthMock, request));

		expect(response.status).toBe(500);
		expect(await response.text()).toContain("AuthServiceError");
	});

	it("passes Better Auth the original source request", async () => {
		const sourceRequest = new Request("http://example.com/api/auth/sign-up/email", {
			body: JSON.stringify({ email: "test@example.com" }),
			headers: {
				"content-type": "application/json",
				"x-auth-mode": "read-json",
			},
			method: "POST",
		});
		const request = HttpServerRequest.fromWeb(sourceRequest);
		const auth: Auth.Interface = {
			handle: (incomingRequest) =>
				Effect.tryPromise({
					try: async () => {
						expect(incomingRequest).toBe(sourceRequest);
						const payload = (await incomingRequest.json()) as { email: string };
						return new Response(payload.email, {
							headers: { "content-type": "text/plain" },
							status: 200,
						});
					},
					catch: (error) =>
						new Auth.AuthError({
							message: error instanceof Error ? error.message : String(error),
						}),
				}),
			getSession: AuthMock.getSession,
		};

		const response = await runResponse(AuthHandler.handlePassthrough(auth, request));

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("test@example.com");
		expect(sourceRequest.bodyUsed).toBe(true);
	});
});
