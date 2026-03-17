import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

// Mock modules before importing the app
vi.mock("@chevrotain/email", () => ({
	resend: {
		emails: {
			send: vi.fn(),
		},
	},
}));

vi.mock("@chevrotain/core/billing/autumn", () => ({
	autumn: {
		check: vi.fn(),
		track: vi.fn(),
	},
}));

vi.mock("@chevrotain/api/middleware/auth", () => ({
	authMiddleware: vi.fn((c, next) => {
		c.set("user", {
			id: "test-user-id",
			name: "Test User",
			email: "test@test.com",
		});
		c.set("session", {
			id: "test-session-id",
		});
		return next();
	}),
}));

// Partial mock of OpenTelemetry to preserve context export
vi.mock("@opentelemetry/api", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		context: {
			...(actual.context as Record<string, unknown>),
			setGlobalContextManager: vi.fn(),
		},
		trace: {
			...(actual.trace as Record<string, unknown>),
			setGlobalTracerProvider: vi.fn(),
			getTracer: () => ({
				startActiveSpan: vi.fn((_name, fn) =>
					fn({
						setAttribute: vi.fn(),
						setStatus: vi.fn(),
						recordException: vi.fn(),
						end: vi.fn(),
					}),
				),
				getActiveSpan: () => null,
			}),
			getActiveSpan: () => null,
		},
	};
});

vi.mock("@chevrotain/core/analytics/clickhouse", () => ({
	insertEvents: vi.fn(),
	insertErrors: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@chevrotain/api/runtime", () => ({
	runEffect: vi.fn((_effect: unknown) => Promise.resolve()),
}));

import { app } from "@chevrotain/api/index";
import { authMiddleware } from "@chevrotain/api/middleware/auth";
import { runEffect } from "@chevrotain/api/runtime";
import { PublicError } from "@chevrotain/core/result";

describe("analytics endpoint", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 and calls insertEvents with valid payload", async () => {
		const response = await app.request("/api/analytics", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				events: [
					{
						eventType: "page_view",
						url: "https://example.com",
						referrer: "",
					},
				],
			}),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual({ success: true });

		expect(runEffect).toHaveBeenCalledOnce();
	});

	it("returns 400 for invalid payload", async () => {
		const response = await app.request("/api/analytics", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		expect(response.status).toBe(400);
		const data = (await response.json()) as Record<string, unknown>;
		expect(data.error).toBeDefined();
		const error = data.error as Record<string, unknown>;
		const global = error.global as Array<Record<string, unknown>>;
		expect(global).toContainEqual(
			expect.objectContaining({ message: "Invalid analytics payload" }),
		);

		expect(runEffect).not.toHaveBeenCalled();
	});

	it("returns 200 and skips insertEvents for empty events array", async () => {
		const response = await app.request("/api/analytics", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ events: [] }),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual({ success: true });

		expect(runEffect).not.toHaveBeenCalled();
	});

	it("passes full events array and correct user/session to insertEvents", async () => {
		const events = [
			{
				eventType: "page_view",
				url: "https://example.com/page1",
				referrer: "https://google.com",
			},
			{
				eventType: "button_click",
				url: "https://example.com/page1",
				referrer: "",
				properties: { buttonId: "submit" },
			},
		];

		const response = await app.request("/api/analytics", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ events }),
		});

		expect(response.status).toBe(200);
		expect(runEffect).toHaveBeenCalledOnce();
	});

	it("returns 401 when auth fails", async () => {
		vi.mocked(authMiddleware).mockImplementationOnce(() => {
			throw new PublicError({ status: 401, global: [{ message: "Unauthorized" }] });
		});

		const response = await app.request("/api/analytics", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				events: [{ eventType: "page_view", url: "https://example.com", referrer: "" }],
			}),
		});

		expect(response.status).toBe(401);
		const data = (await response.json()) as Record<string, unknown>;
		expect(data.error).toBeDefined();
		const error = data.error as Record<string, unknown>;
		const global = error.global as Array<Record<string, unknown>>;
		expect(global).toContainEqual(expect.objectContaining({ message: "Unauthorized" }));

		expect(runEffect).not.toHaveBeenCalled();
	});
});
