import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { Analytics, type ErrorEventRow } from "@chevrotain/core/analytics";
import type { AnalyticsEvent } from "@chevrotain/core/analytics/schema";

const mockInsertEvents =
	vi.fn<(events: AnalyticsEvent[], userId: string, sessionId: string) => void>();
const mockInsertErrors = vi.fn<(errors: ErrorEventRow[]) => void>();

const AnalyticsMock = Layer.succeed(Analytics.Service, {
	insertEvents: (events, userId, sessionId) => {
		mockInsertEvents(events, userId, sessionId);
		return Effect.void;
	},
	insertErrors: (errors) => {
		mockInsertErrors(errors);
		return Effect.void;
	},
});

describe("Analytics integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("provides mock service via Layer", async () => {
		const events: AnalyticsEvent[] = [
			{ eventType: "page_view", url: "https://example.com", referrer: "" },
		];

		const program = Effect.gen(function* () {
			const service = yield* Analytics.Service;
			yield* service.insertEvents(events, "user-1", "session-1");
		});

		await Effect.runPromise(program.pipe(Effect.provide(AnalyticsMock)));

		expect(mockInsertEvents).toHaveBeenCalledWith(events, "user-1", "session-1");
	});
});
