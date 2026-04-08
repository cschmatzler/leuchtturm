import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";

describe("request context middleware", () => {
	it("keeps trusted proxy request ids and generates valid ids otherwise", () => {
		expect(RequestContext.makeRequestId("req_test_123")).toBe("req_test_123");
		expect(RequestContext.makeRequestId("bad id with spaces")).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	it("adds x-request-id headers to error responses", async () => {
		const request = HttpServerRequest.fromWeb(
			new Request("http://example.com/api/query", {
				headers: {
					"x-request-id": "req_from_proxy",
				},
				method: "POST",
			}),
		).modify({ remoteAddress: Option.some("127.0.0.1") });

		const response = await Effect.runPromise(
			RequestContext.Middleware(Effect.fail(new Error("boom"))).pipe(
				Effect.provideService(HttpServerRequest.HttpServerRequest, request),
			),
		);
		const webResponse = HttpServerResponse.toWeb(response);

		expect(webResponse.headers.get("x-request-id")).toBe("req_from_proxy");
		expect(webResponse.status).toBe(500);
	});

	it("keeps gateway request ids when the runtime has no peer address", async () => {
		const request = HttpServerRequest.fromWeb(
			new Request("http://example.com/api/query", {
				headers: {
					"x-request-id": "req_gateway_123",
				},
				method: "POST",
			}),
		);

		const response = await Effect.runPromise(
			RequestContext.Middleware(Effect.fail(new Error("boom"))).pipe(
				Effect.provideService(HttpServerRequest.HttpServerRequest, request),
			),
		);
		const webResponse = HttpServerResponse.toWeb(response);

		expect(webResponse.headers.get("x-request-id")).toBe("req_gateway_123");
		expect(webResponse.status).toBe(500);
	});
});
