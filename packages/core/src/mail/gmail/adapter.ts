/**
 * Gmail API adapter (§13).
 *
 * Uses the Gmail REST API directly with OAuth2 tokens.
 * Handles thread listing, message fetching, label sync, and history-based
 * incremental sync.
 */

import type {
	MailProviderAdapter,
	ProviderAttachment,
	ProviderBodyPart,
	ProviderEmailAddress,
	ProviderHistoryChange,
	ProviderLabel,
	ProviderMessage,
	ProviderMessageHeaders,
	ProviderThread,
} from "@chevrotain/core/mail/provider";
import type { MailFolderKind, MailLabelKind } from "@chevrotain/core/mail/schema";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// ---------------------------------------------------------------------------
// Gmail API types (subset we care about)
// ---------------------------------------------------------------------------

interface GmailLabel {
	id: string;
	name: string;
	type: "system" | "user";
	color?: { textColor?: string; backgroundColor?: string };
}

interface GmailMessagePart {
	partId?: string;
	mimeType?: string;
	filename?: string;
	headers?: Array<{ name: string; value: string }>;
	body?: { attachmentId?: string; size?: number; data?: string };
	parts?: GmailMessagePart[];
}

interface GmailMessage {
	id: string;
	threadId: string;
	labelIds?: string[];
	snippet?: string;
	internalDate?: string;
	payload?: GmailMessagePart;
	sizeEstimate?: number;
}

interface GmailThread {
	id: string;
	messages?: GmailMessage[];
	snippet?: string;
	historyId?: string;
}

interface GmailHistoryRecord {
	messagesAdded?: Array<{ message: GmailMessage }>;
	messagesDeleted?: Array<{ message: { id: string; threadId: string; labelIds?: string[] } }>;
	labelsAdded?: Array<{ message: { id: string; labelIds?: string[] }; labelIds: string[] }>;
	labelsRemoved?: Array<{ message: { id: string; labelIds?: string[] }; labelIds: string[] }>;
}

// ---------------------------------------------------------------------------
// Gmail label → folder kind mapping (§25.1)
// ---------------------------------------------------------------------------

const GMAIL_LABEL_FOLDER_MAP: Record<string, MailFolderKind> = {
	INBOX: "inbox",
	SENT: "sent",
	DRAFT: "drafts",
	TRASH: "trash",
	SPAM: "spam",
};

function gmailLabelKind(type: string): MailLabelKind {
	return type === "system" ? "system" : "user";
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

function getHeader(part: GmailMessagePart, name: string): string | undefined {
	return part.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function parseEmailAddress(raw: string | undefined): ProviderEmailAddress | undefined {
	if (!raw) return undefined;
	const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^\s>]+@[^\s>]+)>?$/);
	if (match) {
		return { name: match[1]?.trim() || undefined, address: match[2]! };
	}
	return { address: raw.trim() };
}

function parseEmailAddresses(raw: string | undefined): ProviderEmailAddress[] {
	if (!raw) return [];
	return raw
		.split(",")
		.map((s) => parseEmailAddress(s.trim()))
		.filter((a): a is ProviderEmailAddress => a !== undefined);
}

function decodeBase64Url(data: string): string {
	const padded = data.replace(/-/g, "+").replace(/_/g, "/");
	return Buffer.from(padded, "base64").toString("utf-8");
}

// ---------------------------------------------------------------------------
// Extract body parts and attachments from Gmail message payload
// ---------------------------------------------------------------------------

function extractParts(
	part: GmailMessagePart,
	bodyParts: ProviderBodyPart[],
	attachments: ProviderAttachment[],
): void {
	const mime = part.mimeType ?? "";

	if (part.filename && part.filename.length > 0) {
		attachments.push({
			providerRef: part.body?.attachmentId,
			filename: part.filename,
			mimeType: mime,
			size: part.body?.size,
			isInline: getHeader(part, "Content-Disposition")?.startsWith("inline") ?? false,
			contentId: getHeader(part, "Content-ID")?.replace(/^<|>$/g, ""),
		});
		return;
	}

	if ((mime === "text/plain" || mime === "text/html") && part.body?.data) {
		const decoded = decodeBase64Url(part.body.data);
		bodyParts.push({
			contentType: mime,
			content: decoded,
		});
		return;
	}

	if (part.parts) {
		for (const child of part.parts) {
			extractParts(child, bodyParts, attachments);
		}
	}
}

// ---------------------------------------------------------------------------
// Convert Gmail message to provider-normalized message
// ---------------------------------------------------------------------------

function extractHeaders(payload: GmailMessagePart): ProviderMessageHeaders {
	const replyToRaw = getHeader(payload, "Reply-To");
	const inReplyTo = getHeader(payload, "In-Reply-To");
	const references = getHeader(payload, "References");
	const listUnsubscribe = getHeader(payload, "List-Unsubscribe");
	const listUnsubscribePost = getHeader(payload, "List-Unsubscribe-Post");

	return {
		replyTo: replyToRaw ? parseEmailAddresses(replyToRaw) : undefined,
		inReplyTo: inReplyTo?.trim(),
		references: references?.trim(),
		listUnsubscribe: listUnsubscribe?.trim(),
		listUnsubscribePost: listUnsubscribePost?.trim(),
	};
}

function normalizeGmailMessage(msg: GmailMessage): ProviderMessage {
	const payload = msg.payload;
	const bodyParts: ProviderBodyPart[] = [];
	const attachments: ProviderAttachment[] = [];

	if (payload) {
		extractParts(payload, bodyParts, attachments);
	}

	const labelIds = msg.labelIds ?? [];

	return {
		providerRef: msg.id,
		internetMessageId: payload ? getHeader(payload, "Message-ID") : undefined,
		threadRef: msg.threadId,
		subject: payload ? getHeader(payload, "Subject") : undefined,
		snippet: msg.snippet,
		sender: payload ? parseEmailAddress(getHeader(payload, "From")) : undefined,
		toRecipients: payload ? parseEmailAddresses(getHeader(payload, "To")) : [],
		ccRecipients: payload ? parseEmailAddresses(getHeader(payload, "Cc")) : [],
		bccRecipients: payload ? parseEmailAddresses(getHeader(payload, "Bcc")) : [],
		sentAt: payload ? parseDate(getHeader(payload, "Date")) : undefined,
		receivedAt: msg.internalDate ? new Date(Number(msg.internalDate)) : undefined,
		isUnread: labelIds.includes("UNREAD"),
		isStarred: labelIds.includes("STARRED"),
		isDraft: labelIds.includes("DRAFT"),
		labelRefs: labelIds,
		headers: payload ? extractHeaders(payload) : undefined,
		bodyParts,
		attachments,
	};
}

function parseDate(raw: string | undefined): Date | undefined {
	if (!raw) return undefined;
	const d = new Date(raw);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

// ---------------------------------------------------------------------------
// Gmail adapter implementation
// ---------------------------------------------------------------------------

export class GmailAdapter implements MailProviderAdapter {
	constructor(private readonly accessToken: string) {}

	private async gmailFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
		const url = new URL(`${GMAIL_API_BASE}${path}`);
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				url.searchParams.set(key, value);
			}
		}

		const response = await fetch(url.toString(), {
			headers: { Authorization: `Bearer ${this.accessToken}` },
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`Gmail API error ${response.status}: ${body}`);
		}

		return response.json() as Promise<T>;
	}

	// -----------------------------------------------------------------------
	// Labels
	// -----------------------------------------------------------------------

	async listLabels(): Promise<ProviderLabel[]> {
		const data = await this.gmailFetch<{ labels: GmailLabel[] }>("/labels");
		return (data.labels ?? []).map((label) => ({
			providerRef: label.id,
			name: label.name,
			color: label.color?.backgroundColor,
			kind: gmailLabelKind(label.type),
		}));
	}

	// -----------------------------------------------------------------------
	// Thread listing for bootstrap (§13, §25.2)
	// -----------------------------------------------------------------------

	async listRecentThreads(cutoff: Date): Promise<ProviderThread[]> {
		const epochSeconds = Math.floor(cutoff.getTime() / 1000);
		const query = `after:${epochSeconds}`;
		const threadIds: string[] = [];
		let pageToken: string | undefined;

		// Paginate through thread list
		do {
			const params: Record<string, string> = { q: query, maxResults: "500" };
			if (pageToken) params.pageToken = pageToken;

			const data = await this.gmailFetch<{
				threads?: Array<{ id: string }>;
				nextPageToken?: string;
			}>("/threads", params);

			if (data.threads) {
				threadIds.push(...data.threads.map((t) => t.id));
			}
			pageToken = data.nextPageToken;
		} while (pageToken);

		// Fetch full thread details (batch in groups to respect rate limits)
		const threads: ProviderThread[] = [];
		const batchSize = 10;

		for (let i = 0; i < threadIds.length; i += batchSize) {
			const batch = threadIds.slice(i, i + batchSize);
			const results = await Promise.all(
				batch.map((id) => this.gmailFetch<GmailThread>(`/threads/${id}`, { format: "full" })),
			);

			for (const thread of results) {
				threads.push({
					providerRef: thread.id,
					messages: (thread.messages ?? []).map(normalizeGmailMessage),
				});
			}
		}

		return threads;
	}

	// -----------------------------------------------------------------------
	// Incremental sync via history (§13)
	// -----------------------------------------------------------------------

	async getHistoryChanges(startHistoryId: string): Promise<{
		changes: ProviderHistoryChange;
		newCursor: string;
		cursorExpired: boolean;
	}> {
		const changes: ProviderHistoryChange = {
			messagesAdded: [],
			messagesDeleted: [],
			labelsAdded: [],
			labelsRemoved: [],
		};

		let pageToken: string | undefined;
		let latestHistoryId = startHistoryId;

		try {
			do {
				const params: Record<string, string> = {
					startHistoryId,
					historyTypes: "messageAdded,messageDeleted,labelAdded,labelRemoved",
					maxResults: "500",
				};
				if (pageToken) params.pageToken = pageToken;

				const data = await this.gmailFetch<{
					history?: GmailHistoryRecord[];
					historyId: string;
					nextPageToken?: string;
				}>("/history", params);

				latestHistoryId = data.historyId;

				for (const record of data.history ?? []) {
					if (record.messagesAdded) {
						for (const added of record.messagesAdded) {
							const fullMessage = await this.getMessage(added.message.id);
							(changes.messagesAdded as ProviderMessage[]).push(fullMessage);
						}
					}

					if (record.messagesDeleted) {
						for (const deleted of record.messagesDeleted) {
							(changes.messagesDeleted as string[]).push(deleted.message.id);
						}
					}

					if (record.labelsAdded) {
						for (const added of record.labelsAdded) {
							(
								changes.labelsAdded as Array<{
									messageRef: string;
									labelRefs: string[];
								}>
							).push({
								messageRef: added.message.id,
								labelRefs: added.labelIds,
							});
						}
					}

					if (record.labelsRemoved) {
						for (const removed of record.labelsRemoved) {
							(
								changes.labelsRemoved as Array<{
									messageRef: string;
									labelRefs: string[];
								}>
							).push({
								messageRef: removed.message.id,
								labelRefs: removed.labelIds,
							});
						}
					}
				}

				pageToken = data.nextPageToken;
			} while (pageToken);
		} catch (error) {
			if (error instanceof Error && error.message.includes("404")) {
				return { changes, newCursor: startHistoryId, cursorExpired: true };
			}
			throw error;
		}

		return { changes, newCursor: latestHistoryId, cursorExpired: false };
	}

	// -----------------------------------------------------------------------
	// Single message fetch
	// -----------------------------------------------------------------------

	async getMessage(providerRef: string): Promise<ProviderMessage> {
		const msg = await this.gmailFetch<GmailMessage>(`/messages/${providerRef}`, {
			format: "full",
		});
		return normalizeGmailMessage(msg);
	}

	// -----------------------------------------------------------------------
	// Latest cursor (historyId from profile)
	// -----------------------------------------------------------------------

	async getLatestCursor(): Promise<string> {
		const profile = await this.gmailFetch<{ historyId: string }>("/profile");
		return profile.historyId;
	}
}

// ---------------------------------------------------------------------------
// Export folder mapping for sync layer
// ---------------------------------------------------------------------------

export function getGmailFolders(
	labels: ProviderLabel[],
): Array<{ providerRef: string; kind: MailFolderKind; name: string }> {
	const folders: Array<{ providerRef: string; kind: MailFolderKind; name: string }> = [];
	for (const label of labels) {
		const kind = GMAIL_LABEL_FOLDER_MAP[label.providerRef];
		if (kind) {
			folders.push({ providerRef: label.providerRef, kind, name: label.name });
		}
	}
	return folders;
}
