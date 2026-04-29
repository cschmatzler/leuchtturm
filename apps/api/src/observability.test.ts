import { Effect, Layer, Logger } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { Observability } from "@leuchtturm/api/observability";
import { makeAxiomLogger } from "@leuchtturm/api/observability/logging";
import { RequestRuntime } from "@leuchtturm/api/request-runtime";

describe("observability helpers", () => {
	it("derives request names, attributes, and log annotations", () => {
		const request = new Request("https://example.com/api/query?cursor=123", {
			method: "POST",
		});

		expect(Observability.requestPath(request)).toBe("/api/query");
		expect(Observability.requestSpanName(request)).toBe("POST /api/query");
		expect(Observability.requestSpanAttributes(request)).toEqual({
			"http.request.method": "POST",
			"http.route": "/api/query",
			"server.address": "example.com",
			"url.path": "/api/query",
			"url.scheme": "https",
		});
		expect(
			Observability.requestLogAnnotations(request, {
				status: 200,
			}),
		).toEqual({
			method: "POST",
			path: "/api/query",
			status: 200,
		});
	});

	it("groups status codes by status family", () => {
		expect(Observability.statusGroup(200)).toBe("2xx");
		expect(Observability.statusGroup(404)).toBe("4xx");
		expect(Observability.statusGroup(503)).toBe("5xx");
	});

	it("supports effect-native relative request urls", () => {
		const request = {
			method: "GET",
			url: "/api/up",
		};

		expect(Observability.requestPath(request)).toBe("/api/up");
		expect(Observability.requestSpanName(request)).toBe("GET /api/up");
		expect(Observability.requestSpanAttributes(request)).toEqual({
			"http.request.method": "GET",
			"http.route": "/api/up",
			"url.path": "/api/up",
			"url.scheme": "http",
		});
	});

	it("ships native effect logs through the axiom logger", async () => {
		const fetchRequests: Array<{ body: string; url: string }> = [];
		const waitUntilPromises: Promise<unknown>[] = [];
		const fetcher = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
			const body = init?.body;
			fetchRequests.push({
				body: typeof body === "string" ? body : "",
				url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
			});

			return Promise.resolve(Response.json({ failed: 0, ingested: 1 }));
		}) as typeof fetch;

		await Effect.runPromise(
			Effect.logInfo("API request completed").pipe(
				Effect.annotateLogs({ status: 200 }),
				Effect.provide(
					Layer.mergeAll(
						Logger.layer([
							makeAxiomLogger(
								{
									dataset: "logs",
									domain: "axiom.example",
									token: "secret",
								},
								fetcher,
							),
						]),
						Layer.succeed(
							RequestRuntime.Service,
							RequestRuntime.Service.of({
								waitUntil: (promise) => waitUntilPromises.push(promise),
							}),
						),
						Layer.succeed(
							RequestContext.Current,
							RequestContext.Current.of({
								method: "POST",
								path: "/api/query",
								requestId: "req_123",
							}),
						),
					),
				),
			),
		);
		await Promise.all(waitUntilPromises);

		expect(fetchRequests).toHaveLength(1);
		expect(fetchRequests[0]?.url).toBe("https://axiom.example/v1/datasets/logs/ingest");
		expect(JSON.parse(fetchRequests[0]?.body ?? "")).toEqual([
			expect.objectContaining({
				level: "info",
				message: "API request completed",
				method: "POST",
				path: "/api/query",
				requestId: "req_123",
				service_name: "leuchtturm-api",
				service_namespace: "leuchtturm",
				status: 200,
			}),
		]);
	});
});
