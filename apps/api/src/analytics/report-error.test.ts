import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { describe, expect, it, vi } from "vite-plus/test";

import { reportApiError } from "@chevrotain/api/analytics/report-error";
import { RequestContext } from "@chevrotain/api/middleware/request-context";
import { Analytics } from "@chevrotain/core/analytics";
import type { Error as AnalyticsErrorEvent } from "@chevrotain/core/analytics/schema";

const mockInsertErrors = vi.fn<(errors: AnalyticsErrorEvent[]) => void>();

const AnalyticsMock: Analytics.Interface = {
	insertEvents: () => Effect.void,
	insertErrors: (errors) => {
		mockInsertErrors(errors);
		return Effect.void;
	},
};

describe("reportApiError", () => {
	it("includes request context and span correlation fields for API errors", async () => {
		mockInsertErrors.mockClear();

		const request = HttpServerRequest.fromWeb(
			new Request("https://api.example.com/api/query?foo=bar", {
				headers: { "user-agent": "vitest" },
				method: "POST",
			}),
		);

		const program = reportApiError(AnalyticsMock, {
			request,
			statusCode: 500,
			error: new Error("boom"),
		}).pipe(
			Effect.provideService(RequestContext, {
				requestId: "req_test_123",
				route: "/api/query",
			}),
			Effect.withSpan("test.request"),
		);

		await Effect.runPromise(program);

		expect(mockInsertErrors).toHaveBeenCalledTimes(1);
		const [errors] = mockInsertErrors.mock.calls[0]!;
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			source: "api",
			errorType: "Error",
			message: "boom",
			method: "POST",
			requestId: "req_test_123",
			route: "/api/query",
			userAgent: "vitest",
		});
		expect(errors[0]?.traceId).toBeTruthy();
		expect(errors[0]?.spanId).toBeTruthy();
	});

	it("does not require request context to report an API error", async () => {
		mockInsertErrors.mockClear();

		const request = HttpServerRequest.fromWeb(
			new Request("https://api.example.com/api/auth/login", {
				headers: { "user-agent": "vitest", "x-request-id": "req_from_header" },
				method: "POST",
			}),
		);

		await Effect.runPromise(
			reportApiError(AnalyticsMock, {
				request,
				statusCode: 500,
				error: { _tag: "AuthServiceError", message: "auth broke" },
			}),
		);

		const [errors] = mockInsertErrors.mock.calls[0]!;
		expect(errors[0]).toMatchObject({
			requestId: "req_from_header",
			route: "/api/auth/*",
		});
	});
});
