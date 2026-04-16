import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { GmailAdapter } from "@leuchtturm/core/mail/gmail/adapter";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("gmail adapter retries", () => {
	it("retries transient errors and eventually succeeds", async () => {
		vi.useFakeTimers();
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: "rate-limited" }), {
					headers: { "retry-after": "0" },
					status: 429,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ historyId: "123" }), {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
			);
		globalThis.fetch = fetchMock;

		const adapter = new GmailAdapter("access-token");
		const resultPromise = Effect.runPromise(adapter.getLatestCursor());
		await vi.runAllTimersAsync();

		await expect(resultPromise).resolves.toBe("123");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not retry non-retryable errors", async () => {
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
			new Response("unauthorized", {
				status: 401,
			}),
		);
		globalThis.fetch = fetchMock;

		const adapter = new GmailAdapter("access-token");
		await expect(Effect.runPromise(adapter.getLatestCursor())).rejects.toMatchObject({
			name: "GmailApiError",
			status: 401,
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
