import { api } from "@roasted/web/clients/api";

type AnalyticsEvent = {
	eventType: string;
	url: string;
	referrer: string;
	properties?: Record<string, unknown>;
};

type AnalyticsLocation = {
	url: string;
	referrer: string;
};

const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 50;
const MAX_PAYLOAD_BYTES = 50 * 1024;

let buffer: AnalyticsEvent[] = [];
let isInitialized = false;

function pushEvent(
	eventType: string,
	url: string,
	referrer: string,
	properties?: Record<string, unknown>,
): void {
	buffer.push({
		eventType,
		url,
		referrer,
		properties,
	});

	if (buffer.length >= MAX_BUFFER_SIZE) {
		void flush();
	}
}

async function sendBatch(events: AnalyticsEvent[]): Promise<void> {
	await api.analytics.$post({
		json: { events },
	});
}

async function splitAndSend(events: AnalyticsEvent[]): Promise<void> {
	const encoder = new TextEncoder();
	let currentBatch: AnalyticsEvent[] = [];

	for (const event of events) {
		const candidateBatch = [...currentBatch, event];
		const candidatePayload = JSON.stringify({ events: candidateBatch });

		if (
			encoder.encode(candidatePayload).byteLength > MAX_PAYLOAD_BYTES &&
			currentBatch.length > 0
		) {
			await sendBatch(currentBatch);
			currentBatch = [event];
			continue;
		}

		currentBatch = candidateBatch;
	}

	if (currentBatch.length > 0) {
		await sendBatch(currentBatch);
	}
}

export async function flush(): Promise<void> {
	if (buffer.length === 0) {
		return;
	}

	const events = buffer;
	buffer = [];

	await splitAndSend(events);
}

export function track(
	eventType: string,
	analyticsLocation: AnalyticsLocation,
	properties?: Record<string, unknown>,
): void {
	pushEvent(eventType, analyticsLocation.url, analyticsLocation.referrer, properties);
}

export function trackPageView(url: string, referrer: string): void {
	pushEvent("page_view", url, referrer);
}

function initializeAnalytics(): void {
	if (isInitialized) {
		return;
	}

	if (typeof document === "undefined" || typeof window === "undefined") {
		return;
	}

	isInitialized = true;

	setInterval(() => {
		void flush();
	}, FLUSH_INTERVAL_MS);

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			void flush();
		}
	});

	window.addEventListener("pagehide", () => {
		void flush();
	});
}

initializeAnalytics();
