import { mustGetMutator, mustGetQuery } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import { handleAuthPassthrough } from "@chevrotain/api/handlers/auth";
import { getReportErrorsRateLimitKey } from "@chevrotain/api/handlers/rpc";
import { applyHttpAuth } from "@chevrotain/api/middleware/auth-live";
import { Auth } from "@chevrotain/core/auth/index";
import { RATE_LIMIT_MAX_REQUESTS, RateLimit } from "@chevrotain/core/rate-limit";
import { mutators } from "@chevrotain/zero/mutators";
import { queries } from "@chevrotain/zero/queries";
import { schema } from "@chevrotain/zero/schema";

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

describe("review findings", () => {
	describe("auth failure classification", () => {
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

	describe("report error rate limiting", () => {
		it("ignores spoofed forwarding headers and keys limits off the peer address", async () => {
			const requests = Array.from({ length: RATE_LIMIT_MAX_REQUESTS + 1 }, (_, index) =>
				HttpServerRequest.fromWeb(
					new Request("http://example.com/api/rpc", {
						headers: {
							"x-forwarded-for": `198.51.100.${index}`,
							"x-real-ip": `203.0.113.${index}`,
						},
					}),
				).modify({ remoteAddress: Option.some("10.0.0.9") }),
			);

			expect(new Set(requests.map(getReportErrorsRateLimitKey))).toEqual(new Set(["10.0.0.9"]));

			const program = Effect.gen(function* () {
				const rateLimit = yield* RateLimit.Service;

				for (const request of requests.slice(0, -1)) {
					yield* rateLimit.check(getReportErrorsRateLimitKey(request), "Too many error reports");
				}

				return yield* rateLimit.check(
					getReportErrorsRateLimitKey(requests[requests.length - 1]!),
					"Too many error reports",
				);
			}).pipe(Effect.provide(RateLimit.defaultLayer));

			await expect(Effect.runPromise(program)).rejects.toMatchObject({
				_tag: "RateLimitError",
				message: "Too many error reports",
			});
		});
	});

	describe("zero unknown operations", () => {
		it("returns an application error payload for unknown queries instead of throwing", async () => {
			const result = await handleQueryRequest(
				(name, args) => {
					const query = mustGetQuery(queries, name);
					return query.fn({ args, ctx: { userId: TEST_SESSION.user.id } });
				},
				schema,
				new Request("http://example.com/api/query", {
					body: JSON.stringify(["transform", [{ args: [], id: "query-1", name: "missing.query" }]]),
					headers: { "content-type": "application/json" },
					method: "POST",
				}),
			);

			expect(result).toEqual([
				"transformed",
				[
					{
						error: "app",
						id: "query-1",
						message: "Query not found: missing.query",
						name: "missing.query",
					},
				],
			]);
		});

		it("returns an application error payload for unknown mutators instead of throwing", async () => {
			const result = await handleMutateRequest(
				{
					transaction: async (transact: any) =>
						transact(
							{},
							{
								updateClientMutationID: async () => ({ lastMutationID: 1 }),
								writeMutationResult: async () => undefined,
							},
						),
				} as never,
				async (transact) =>
					transact(async (tx, name, args) => {
						const mutator = mustGetMutator(mutators, name);
						return mutator.fn({ tx, ctx: { userId: TEST_SESSION.user.id }, args });
					}),
				new Request("http://example.com/api/mutate?schema=public&appID=web", {
					body: JSON.stringify({
						clientGroupID: "group-1",
						mutations: [
							{
								args: [],
								clientID: "client-1",
								id: 1,
								name: "missing.mutator",
								timestamp: 0,
								type: "custom",
							},
						],
						pushVersion: 1,
						requestID: "request-1",
						schemaVersion: 1,
						timestamp: 0,
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
				}),
			);

			expect(result).toEqual({
				mutations: [
					{
						id: {
							clientID: "client-1",
							id: 1,
						},
						result: {
							error: "app",
							message: "Mutator not found: missing.mutator",
						},
					},
				],
			});
		});
	});
});
