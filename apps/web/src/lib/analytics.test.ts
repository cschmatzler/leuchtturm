import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";

const { ingestEventsMock, reportErrorsMock } = vi.hoisted(() => ({
	ingestEventsMock: vi.fn(),
	reportErrorsMock: vi.fn(),
}));

vi.mock("@chevrotain/web/clients/rpc", () => ({
	ingestEvents: ingestEventsMock,
	reportErrors: reportErrorsMock,
}));

type AnalyticsModule = typeof import("@chevrotain/web/lib/analytics");

let documentAddEventListenerMock: ReturnType<typeof vi.fn>;
let windowAddEventListenerMock: ReturnType<typeof vi.fn>;
let sendBeaconMock: ReturnType<typeof vi.fn>;

const defaultLocation = {
	url: "https://chevrotain.app/dashboard",
	referrer: "https://example.com",
};

async function loadAnalyticsModule(): Promise<AnalyticsModule> {
	vi.resetModules();
	return await import("@chevrotain/web/lib/analytics");
}

describe("analytics", () => {
	beforeEach(() => {
		vi.useFakeTimers();

		ingestEventsMock.mockReset();
		ingestEventsMock.mockResolvedValue(undefined);
		reportErrorsMock.mockReset();
		reportErrorsMock.mockResolvedValue(undefined);

		sendBeaconMock = vi.fn().mockReturnValue(true);
		documentAddEventListenerMock = vi.fn();
		windowAddEventListenerMock = vi.fn();

		vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });
		vi.stubGlobal("document", {
			addEventListener: documentAddEventListenerMock,
			visibilityState: "visible",
			referrer: "https://example.com",
		});
		vi.stubGlobal("window", {
			location: { href: "https://chevrotain.app/dashboard" },
			addEventListener: windowAddEventListenerMock,
		});
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("track() adds event to internal buffer", async () => {
		const analytics = await loadAnalyticsModule();

		analytics.track("button_click", defaultLocation, { buttonId: "save" });
		analytics.track("form_submit", defaultLocation);
		await analytics.flush();

		expect(ingestEventsMock).toHaveBeenCalledOnce();
		const payload = ingestEventsMock.mock.calls[0][0] as {
			events: Array<Record<string, unknown>>;
		};
		expect(payload.events).toHaveLength(2);
		expect(payload.events[0]).toEqual({
			eventType: "button_click",
			url: "https://chevrotain.app/dashboard",
			referrer: "https://example.com",
			properties: { buttonId: "save" },
		});
		expect(payload.events[1]).toEqual({
			eventType: "form_submit",
			url: "https://chevrotain.app/dashboard",
			referrer: "https://example.com",
			properties: undefined,
		});
	});

	it("buffer flushes when size reaches 50 events", async () => {
		const analytics = await loadAnalyticsModule();

		for (let index = 0; index < 50; index++) {
			analytics.track("event", defaultLocation, { index });
		}

		await vi.advanceTimersByTimeAsync(0);

		expect(ingestEventsMock).toHaveBeenCalledOnce();
		const payload = ingestEventsMock.mock.calls[0][0] as {
			events: Array<Record<string, unknown>>;
		};
		expect(payload.events).toHaveLength(50);
	});

	it("buffer flushes on timer (5s interval)", async () => {
		const analytics = await loadAnalyticsModule();

		analytics.track("page_view", defaultLocation);
		expect(ingestEventsMock).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(5000);

		expect(ingestEventsMock).toHaveBeenCalledOnce();
		const payload = ingestEventsMock.mock.calls[0][0] as {
			events: Array<Record<string, unknown>>;
		};
		expect(payload.events).toHaveLength(1);
		expect(payload.events[0]?.eventType).toBe("page_view");
	});

	it("buffer flushes on visibilitychange to hidden", async () => {
		const analytics = await loadAnalyticsModule();

		const visibilityCall = documentAddEventListenerMock.mock.calls.find(
			(call: unknown[]) => call[0] === "visibilitychange",
		);
		expect(visibilityCall).toBeDefined();
		const visibilityHandler = visibilityCall?.[1] as () => void;

		analytics.track("some_event", defaultLocation);

		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			writable: true,
			configurable: true,
		});
		visibilityHandler();
		await vi.advanceTimersByTimeAsync(0);

		expect(ingestEventsMock).toHaveBeenCalledOnce();
	});

	it("flush sends events via RPC client", async () => {
		const analytics = await loadAnalyticsModule();

		analytics.track("test_event", defaultLocation);
		await analytics.flush();

		expect(ingestEventsMock).toHaveBeenCalledWith({
			events: expect.any(Array),
		});
	});

	it("flush does not use sendBeacon when request fails", async () => {
		ingestEventsMock.mockRejectedValueOnce(new Error("Network error"));
		const analytics = await loadAnalyticsModule();

		analytics.track("test_event", defaultLocation);

		await expect(analytics.flush()).rejects.toThrow("Network error");
		expect(sendBeaconMock).not.toHaveBeenCalled();
	});

	it("serialized payload is capped at 50KB and splits batch if exceeded", async () => {
		const analytics = await loadAnalyticsModule();
		const largeProperties = { data: "x".repeat(2000) };

		for (let index = 0; index < 30; index++) {
			analytics.track("large_event", defaultLocation, largeProperties);
		}

		await analytics.flush();

		expect(ingestEventsMock.mock.calls.length).toBeGreaterThanOrEqual(2);
		for (const call of ingestEventsMock.mock.calls) {
			const payload = call[0] as {
				events: Array<Record<string, unknown>>;
			};
			const byteLength = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
			expect(byteLength).toBeLessThanOrEqual(50 * 1024);
		}
	});

	it("trackPageView() sends event with provided url and referrer", async () => {
		const analytics = await loadAnalyticsModule();

		analytics.trackPageView("/dashboard", "/login");
		await analytics.flush();

		expect(ingestEventsMock).toHaveBeenCalledOnce();
		const payload = ingestEventsMock.mock.calls[0][0] as {
			events: Array<Record<string, unknown>>;
		};
		expect(payload.events).toHaveLength(1);
		expect(payload.events[0]).toEqual({
			eventType: "page_view",
			url: "/dashboard",
			referrer: "/login",
			properties: undefined,
		});
	});

	it("flush does nothing when buffer is empty", async () => {
		const analytics = await loadAnalyticsModule();

		await analytics.flush();
		expect(ingestEventsMock).not.toHaveBeenCalled();
		expect(sendBeaconMock).not.toHaveBeenCalled();
	});

	it("registers pagehide listener on window during module initialization", async () => {
		await loadAnalyticsModule();

		const pagehideCall = windowAddEventListenerMock.mock.calls.find(
			(call: unknown[]) => call[0] === "pagehide",
		);
		expect(pagehideCall).toBeDefined();
	});
});
