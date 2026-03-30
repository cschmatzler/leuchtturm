import { ConfigProvider, Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { describe, expect, it, vi } from "vite-plus/test";

import { reportApiError } from "@chevrotain/api/analytics/report-error";
import { RequestContext } from "@chevrotain/api/middleware/request-context";
import { Analytics } from "@chevrotain/core/analytics/index";
import type { ErrorEvent } from "@chevrotain/core/analytics/schema";

const mockInsertErrors = vi.fn<(errors: ErrorEvent[]) => void>();

const AnalyticsMock: Analytics.Interface = {
	insertEvents: () => Effect.void,
	insertErrors: (errors) => {
		mockInsertErrors(errors);
		return Effect.void;
	},
};

const TestConfigLayer = ConfigProvider.layer(
	ConfigProvider.fromEnv({
		env: {
			BASE_URL: "https://app.example.com",
			CLICKHOUSE_URL: "https://clickhouse.example.com",
			DATABASE_URL: "postgres://postgres:postgres@localhost:5432/chevrotain",
			GITHUB_CLIENT_ID: "github-client-id",
			GITHUB_CLIENT_SECRET: "github-client-secret",
			POLAR_ACCESS_TOKEN: "polar-access-token",
			POLAR_SUCCESS_URL: "https://app.example.com/billing/success",
			POLAR_WEBHOOK_SECRET: "polar-webhook-secret",
			PORT: "3000",
			RESEND_API_KEY: "resend-api-key",
		},
	}),
);

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
			Effect.provide(TestConfigLayer),
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
			serviceNamespace: "chevrotain",
			serviceName: "api",
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
			}).pipe(Effect.provide(TestConfigLayer)),
		);

		const [errors] = mockInsertErrors.mock.calls[0]!;
		expect(errors[0]).toMatchObject({
			requestId: "req_from_header",
			route: "/api/auth/*",
		});
	});
});
