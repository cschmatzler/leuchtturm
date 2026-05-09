import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { describe, expect, it } from "vite-plus/test";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { Observability } from "@leuchtturm/api/observability";
import { makeAxiomLogger } from "@leuchtturm/api/observability/logging";
import { RequestRuntime } from "@leuchtturm/api/request-runtime";

describe("observability helpers", () => {
	it("derives request names, attributes, and log annotations", () => {
		const request = new Request("https://example.com/query?cursor=123", {
			method: "POST",
		});

		expect(Observability.requestPath(request)).toBe("/query");
		expect(Observability.requestSpanName(request)).toBe("POST /query");
		expect(Observability.requestSpanAttributes(request)).toEqual({
			"http.request.method": "POST",
			"http.route": "/query",
			"server.address": "example.com",
			"url.path": "/query",
			"url.scheme": "https",
		});
		expect(
			Observability.requestLogAnnotations(request, {
				status: 200,
			}),
		).toEqual({
			method: "POST",
			path: "/query",
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
			url: "/up",
		};

		expect(Observability.requestPath(request)).toBe("/up");
		expect(Observability.requestSpanName(request)).toBe("GET /up");
		expect(Observability.requestSpanAttributes(request)).toEqual({
			"http.request.method": "GET",
			"http.route": "/up",
			"url.path": "/up",
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
								path: "/query",
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
				path: "/query",
				requestId: "req_123",
				service_name: "leuchtturm-api",
				service_namespace: "leuchtturm",
				status: 200,
			}),
		]);
	});

	it("ships logs run through a captured request context", async () => {
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
			Effect.gen(function* () {
				const context = yield* Effect.context<never>();

				yield* Effect.promise(() =>
					Effect.runPromiseWith(context)(
						Effect.logInfo("Auth team updated").pipe(
							Effect.annotateLogs({ organizationId: "org_123", teamId: "tea_123" }),
						),
					),
				);
			}).pipe(
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
								path: "/auth/organization/update-team",
								requestId: "req_123",
							}),
						),
					),
				),
			),
		);
		await Promise.all(waitUntilPromises);

		expect(fetchRequests).toHaveLength(1);
		expect(JSON.parse(fetchRequests[0]?.body ?? "")).toEqual([
			expect.objectContaining({
				level: "info",
				message: "Auth team updated",
				method: "POST",
				organizationId: "org_123",
				path: "/auth/organization/update-team",
				requestId: "req_123",
				teamId: "tea_123",
			}),
		]);
	});
});
