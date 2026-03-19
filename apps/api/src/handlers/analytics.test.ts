import { Effect, Layer } from "effect";
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

import type { AnalyticsEvent } from "@chevrotain/core/analytics/schema";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import type { ErrorEventRow } from "@chevrotain/core/analytics/service";

const mockInsertEvents =
	vi.fn<(events: AnalyticsEvent[], userId: string, sessionId: string) => void>();
const mockInsertErrors = vi.fn<(errors: ErrorEventRow[]) => void>();

const ClickHouseServiceMock = Layer.succeed(ClickHouseService, {
	insertEvents: (events, userId, sessionId) => {
		mockInsertEvents(events, userId, sessionId);
		return Effect.void;
	},
	insertErrors: (errors) => {
		mockInsertErrors(errors);
		return Effect.void;
	},
});

describe("ClickHouseService integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("provides mock service via Layer", async () => {
		const events: AnalyticsEvent[] = [
			{ eventType: "page_view", url: "https://example.com", referrer: "" },
		];

		const program = Effect.gen(function* () {
			const service = yield* ClickHouseService;
			yield* service.insertEvents(events, "user-1", "session-1");
		});

		await Effect.runPromise(program.pipe(Effect.provide(ClickHouseServiceMock)));

		expect(mockInsertEvents).toHaveBeenCalledWith(events, "user-1", "session-1");
	});
});
