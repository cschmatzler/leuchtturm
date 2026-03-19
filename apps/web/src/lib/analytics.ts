import { ingestEvents, reportErrors } from "@chevrotain/web/clients/rpc";

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

type ErrorReport = {
	errorType: string;
	message: string;
	stackTrace?: string;
	url?: string;
	properties?: Record<string, unknown>;
};

const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 50;
const MAX_PAYLOAD_BYTES = 50 * 1024;
const ERROR_FLUSH_DELAY_MS = 1000;
const ERROR_DEDUP_WINDOW_MS = 60_000;

let buffer: AnalyticsEvent[] = [];
let errorBuffer: ErrorReport[] = [];
let errorFlushTimer: ReturnType<typeof setTimeout> | null = null;
const reportedErrors = new Map<string, number>();
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
	await ingestEvents({ events });
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

function errorFingerprint(errorType: string, message: string): string {
	return `${errorType}:${message}`;
}

function isErrorDuplicate(errorType: string, message: string): boolean {
	const key = errorFingerprint(errorType, message);
	const now = Date.now();
	const lastReported = reportedErrors.get(key);

	if (lastReported && now - lastReported < ERROR_DEDUP_WINDOW_MS) {
		return true;
	}

	reportedErrors.set(key, now);
	return false;
}

function scheduleErrorFlush(): void {
	if (errorFlushTimer) {
		return;
	}

	errorFlushTimer = setTimeout(() => {
		errorFlushTimer = null;
		void flushErrors();
	}, ERROR_FLUSH_DELAY_MS);
}

async function flushErrors(): Promise<void> {
	if (errorBuffer.length === 0) {
		return;
	}

	const errors = errorBuffer;
	errorBuffer = [];

	try {
		await reportErrors({ errors });
	} catch {}
}

export function sendErrorReport(
	errorType: string,
	message: string,
	stackTrace?: string,
	properties?: Record<string, unknown>,
): void {
	if (typeof window === "undefined") {
		return;
	}

	if (isErrorDuplicate(errorType, message)) {
		return;
	}

	errorBuffer.push({
		errorType,
		message,
		stackTrace,
		url: window.location.href,
		properties,
	});

	scheduleErrorFlush();
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
			void flushErrors();
		}
	});

	window.addEventListener("pagehide", () => {
		void flush();
		void flushErrors();
	});

	window.addEventListener("error", (event) => {
		sendErrorReport(
			event.error?.name ?? "Error",
			event.message || "Unknown error",
			event.error?.stack,
		);
	});

	window.addEventListener("unhandledrejection", (event) => {
		const reason = event.reason;
		const errorType = reason instanceof Error ? reason.name : "UnhandledRejection";
		const message = reason instanceof Error ? reason.message : String(reason);
		const stackTrace = reason instanceof Error ? reason.stack : undefined;

		sendErrorReport(errorType, message, stackTrace);
	});
}

initializeAnalytics();
