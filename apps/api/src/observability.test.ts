import { describe, expect, it } from "vite-plus/test";

import { Observability } from "@leuchtturm/api/observability";

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
});
