import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

const { mockInsert } = vi.hoisted(() => ({
	mockInsert: vi.fn(),
}));

import { analyticsClient, insertEvents } from "@one/core/analytics/clickhouse";
import type { AnalyticsEvent } from "@one/core/analytics/schema";

describe("insertEvents", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(analyticsClient, "insert").mockImplementation(mockInsert);
	});

	it("calls client.insert with correct table name and format", async () => {
		const events: AnalyticsEvent[] = [
			{
				eventType: "page_view",
				url: "https://example.com",
				referrer: "https://google.com",
			},
		];

		await insertEvents(events, "user_123", "session_456");

		expect(mockInsert).toHaveBeenCalledOnce();
		expect(mockInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				table: "analytics_events",
				format: "JSONEachRow",
			}),
		);
	});

	it("maps events to ClickHouse rows with event_id, timestamp, user_id, session_id", async () => {
		const events: AnalyticsEvent[] = [
			{
				eventType: "click",
				url: "https://example.com/page",
				referrer: "https://example.com",
				properties: { buttonId: "cta" },
			},
		];

		await insertEvents(events, "user_abc", "session_xyz");

		const insertCall = mockInsert.mock.calls[0][0] as {
			values: Array<Record<string, unknown>>;
		};
		const row = insertCall.values[0];

		expect(row.event_type).toBe("click");
		expect(row.url).toBe("https://example.com/page");
		expect(row.referrer).toBe("https://example.com");
		expect(row.user_id).toBe("user_abc");
		expect(row.session_id).toBe("session_xyz");
		expect(row.event_id).toEqual(expect.any(String));
		expect(row.timestamp).toEqual(expect.any(String));
		expect(row.timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
	});

	it("serializes properties object to JSON string", async () => {
		const events: AnalyticsEvent[] = [
			{
				eventType: "custom",
				url: "https://example.com",
				referrer: "",
				properties: { key: "value", nested: { a: 1 } },
			},
		];

		await insertEvents(events, "user_1", "session_1");

		const insertCall = mockInsert.mock.calls[0][0] as {
			values: Array<Record<string, unknown>>;
		};
		const row = insertCall.values[0];

		expect(row.properties).toBe(JSON.stringify({ key: "value", nested: { a: 1 } }));
	});

	it("defaults properties to empty JSON object when undefined", async () => {
		const events: AnalyticsEvent[] = [
			{
				eventType: "page_view",
				url: "https://example.com",
				referrer: "",
			},
		];

		await insertEvents(events, "user_1", "session_1");

		const insertCall = mockInsert.mock.calls[0][0] as {
			values: Array<Record<string, unknown>>;
		};
		const row = insertCall.values[0];

		expect(row.properties).toBe("{}");
	});

	it("maps multiple events to multiple rows", async () => {
		const events: AnalyticsEvent[] = [
			{
				eventType: "page_view",
				url: "https://example.com/a",
				referrer: "",
			},
			{
				eventType: "click",
				url: "https://example.com/b",
				referrer: "https://example.com/a",
				properties: { target: "link" },
			},
		];

		await insertEvents(events, "user_1", "session_1");

		const insertCall = mockInsert.mock.calls[0][0] as {
			values: Array<Record<string, unknown>>;
		};

		expect(insertCall.values).toHaveLength(2);
		expect(insertCall.values[0].event_type).toBe("page_view");
		expect(insertCall.values[1].event_type).toBe("click");
	});
});
