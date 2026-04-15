import { Effect } from "effect";

import type {
	MailProviderAdapter,
	ProviderAttachment,
	ProviderBodyPart,
	ProviderEmailAddress,
	ProviderFolder,
	ProviderLabel,
	ProviderMessage,
	ProviderMessageHeaders,
	ProviderThread,
} from "@leuchtturm/core/mail/provider";
import type { MailFolderKind, MailLabelKind } from "@leuchtturm/core/mail/schema";

export interface GmailProviderLabel extends ProviderLabel {
	readonly providerStatePayload: GmailLabel;
}

export interface GmailProviderFolder extends ProviderFolder {
	readonly providerStatePayload: {
		readonly kind: MailFolderKind;
		readonly labelId: string;
		readonly labelName: string;
	};
}

export interface GmailProviderMessage extends ProviderMessage {
	readonly providerStatePayload: GmailMessage;
}

export interface GmailProviderThread extends ProviderThread {
	readonly messages: GmailProviderMessage[];
}

export interface GmailProviderHistoryChange {
	readonly labelsAdded: Array<{ readonly labelRefs: string[]; readonly messageRef: string }>;
	readonly labelsRemoved: Array<{ readonly labelRefs: string[]; readonly messageRef: string }>;
	readonly messagesAdded: GmailProviderMessage[];
	readonly messagesDeleted: string[];
}

export interface GmailHistoryChangesResult {
	readonly changes: GmailProviderHistoryChange;
	readonly newCursor: string;
	readonly cursorExpired: boolean;
}

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailApiError extends Error {
	constructor(
		readonly status: number,
		readonly body: string,
	) {
		super(`Gmail API error ${status}: ${body}`);
		this.name = "GmailApiError";
	}
}

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

function getHeader(part: GmailMessagePart, name: string): string | undefined {
	return part.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function parseEmailAddress(raw: string | undefined): ProviderEmailAddress | undefined {
	if (!raw) return undefined;
	const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^\s>]+@[^\s>]+)>?$/);
	return match
		? { name: match[1]?.trim() || undefined, address: match[2]! }
		: { address: raw.trim() };
}

function parseEmailAddresses(raw: string | undefined): ProviderEmailAddress[] {
	if (!raw) return [];
	return raw
		.split(",")
		.map((s) => parseEmailAddress(s.trim()))
		.filter((a): a is ProviderEmailAddress => a !== undefined);
}

function decodeBase64Url(data: string): string {
	return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function parseDate(raw: string | undefined): Date | undefined {
	if (!raw) return undefined;
	const d = new Date(raw);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

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
		bodyParts.push({ contentType: mime, content: decodeBase64Url(part.body.data) });
		return;
	}

	if (part.parts) {
		for (const child of part.parts) {
			extractParts(child, bodyParts, attachments);
		}
	}
}

function extractHeaders(payload: GmailMessagePart): ProviderMessageHeaders {
	return {
		replyTo: getHeader(payload, "Reply-To")
			? parseEmailAddresses(getHeader(payload, "Reply-To"))
			: undefined,
		inReplyTo: getHeader(payload, "In-Reply-To")?.trim(),
		references: getHeader(payload, "References")?.trim(),
		listUnsubscribe: getHeader(payload, "List-Unsubscribe")?.trim(),
		listUnsubscribePost: getHeader(payload, "List-Unsubscribe-Post")?.trim(),
	};
}

function normalizeGmailMessage(msg: GmailMessage): GmailProviderMessage {
	const payload = msg.payload;
	const bodyParts: ProviderBodyPart[] = [];
	const attachments: ProviderAttachment[] = [];
	if (payload) extractParts(payload, bodyParts, attachments);

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
		providerStatePayload: msg,
	};
}

export class GmailAdapter implements MailProviderAdapter {
	constructor(private readonly accessToken: string) {}

	private toError(error: unknown): Error {
		return error instanceof Error ? error : new Error(String(error));
	}

	private lift<A>(operation: () => Promise<A>): Effect.Effect<A, Error> {
		return Effect.tryPromise({
			try: operation,
			catch: (error) => this.toError(error),
		});
	}

	private async gmailRequest<T>(
		path: string,
		options?: { params?: Record<string, string | readonly string[]>; body?: unknown },
	): Promise<T> {
		const url = new URL(`${GMAIL_API_BASE}${path}`);
		if (options?.params) {
			for (const [key, value] of Object.entries(options.params)) {
				if (typeof value === "string") {
					url.searchParams.set(key, value);
					continue;
				}

				if (Array.isArray(value)) {
					for (const item of value) {
						url.searchParams.append(key, item);
					}
				}
			}
		}

		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.accessToken}`,
		};
		const init: RequestInit = { headers };

		if (options?.body !== undefined) {
			init.method = "POST";
			headers["Content-Type"] = "application/json";
			init.body = JSON.stringify(options.body);
		}

		const response = await fetch(url.toString(), init);
		if (!response.ok) {
			const text = await response.text();
			throw new GmailApiError(response.status, text);
		}

		return response.json() as Promise<T>;
	}

	private async getMessagePromise(providerRef: string): Promise<GmailProviderMessage> {
		const msg = await this.gmailRequest<GmailMessage>(`/messages/${providerRef}`, {
			params: { format: "full" },
		});
		return normalizeGmailMessage(msg);
	}

	listLabels(): Effect.Effect<GmailProviderLabel[], Error> {
		return this.lift(async () => {
			const data = await this.gmailRequest<{ labels: GmailLabel[] }>("/labels");
			return (data.labels ?? []).map((label) => {
				const hasHierarchy = label.name.includes("/");
				return {
					providerRef: label.id,
					name: hasHierarchy ? label.name.split("/").pop()! : label.name,
					path: label.name,
					delimiter: hasHierarchy ? "/" : undefined,
					color: label.color?.backgroundColor,
					kind: gmailLabelKind(label.type),
					providerStatePayload: label,
				};
			});
		});
	}

	listRecentThreads(cutoff: Date): Effect.Effect<GmailProviderThread[], Error> {
		return this.lift(async () => {
			const query = `after:${Math.floor(cutoff.getTime() / 1000)}`;
			const threadIds: string[] = [];
			let pageToken: string | undefined;

			do {
				const params: Record<string, string> = { q: query, maxResults: "500" };
				if (pageToken) params.pageToken = pageToken;

				const data = await this.gmailRequest<{
					threads?: Array<{ id: string }>;
					nextPageToken?: string;
				}>("/threads", { params });

				if (data.threads) threadIds.push(...data.threads.map((t) => t.id));
				pageToken = data.nextPageToken;
			} while (pageToken);

			const threads: GmailProviderThread[] = [];
			const BATCH_SIZE = 10;

			for (let i = 0; i < threadIds.length; i += BATCH_SIZE) {
				const batch = threadIds.slice(i, i + BATCH_SIZE);
				const results = await Promise.all(
					batch.map((id) =>
						this.gmailRequest<GmailThread>(`/threads/${id}`, { params: { format: "full" } }),
					),
				);
				for (const thread of results) {
					threads.push({
						providerRef: thread.id,
						messages: (thread.messages ?? []).map(normalizeGmailMessage),
					});
				}
			}

			return threads;
		});
	}

	getHistoryChanges(startHistoryId: string): Effect.Effect<GmailHistoryChangesResult, Error> {
		return this.lift(async () => {
			const changes: GmailProviderHistoryChange = {
				messagesAdded: [],
				messagesDeleted: [],
				labelsAdded: [],
				labelsRemoved: [],
			};

			let pageToken: string | undefined;
			let latestHistoryId = startHistoryId;

			try {
				do {
					const params: Record<string, string | readonly string[]> = {
						startHistoryId,
						historyTypes: ["messageAdded", "messageDeleted", "labelAdded", "labelRemoved"],
						maxResults: "500",
					};
					if (pageToken) params.pageToken = pageToken;

					const data = await this.gmailRequest<{
						history?: GmailHistoryRecord[];
						historyId: string;
						nextPageToken?: string;
					}>("/history", { params });

					latestHistoryId = data.historyId;

					for (const record of data.history ?? []) {
						if (record.messagesAdded) {
							for (const added of record.messagesAdded) {
								changes.messagesAdded.push(await this.getMessagePromise(added.message.id));
							}
						}
						if (record.messagesDeleted) {
							for (const deleted of record.messagesDeleted) {
								changes.messagesDeleted.push(deleted.message.id);
							}
						}
						if (record.labelsAdded) {
							for (const added of record.labelsAdded) {
								changes.labelsAdded.push({
									messageRef: added.message.id,
									labelRefs: added.labelIds,
								});
							}
						}
						if (record.labelsRemoved) {
							for (const removed of record.labelsRemoved) {
								changes.labelsRemoved.push({
									messageRef: removed.message.id,
									labelRefs: removed.labelIds,
								});
							}
						}
					}

					pageToken = data.nextPageToken;
				} while (pageToken);
			} catch (error) {
				const gmailError = error as { readonly name?: unknown; readonly status?: unknown };
				if (gmailError.name === "GmailApiError" && gmailError.status === 404) {
					return { changes, newCursor: startHistoryId, cursorExpired: true };
				}
				throw error;
			}

			return { changes, newCursor: latestHistoryId, cursorExpired: false };
		});
	}

	getMessage(providerRef: string): Effect.Effect<GmailProviderMessage, Error> {
		return this.lift(() => this.getMessagePromise(providerRef));
	}

	getLatestCursor(): Effect.Effect<string, Error> {
		return this.lift(async () => {
			const profile = await this.gmailRequest<{ historyId: string }>("/profile");
			return profile.historyId;
		});
	}

	watch(topicName: string): Effect.Effect<{ historyId: string; expiration: number }, Error> {
		return this.lift(async () => {
			const data = await this.gmailRequest<{ historyId: string; expiration: string }>("/watch", {
				body: { topicName, labelFilterBehavior: "INCLUDE" },
			});
			return { historyId: data.historyId, expiration: Number(data.expiration) };
		});
	}

	stopWatch(): Effect.Effect<void, Error> {
		return this.lift(async () => {
			await this.gmailRequest("/stop", { body: {} });
		});
	}
}

export function getGmailFolders(labels: readonly GmailProviderLabel[]): GmailProviderFolder[] {
	const folders: GmailProviderFolder[] = [];
	for (const label of labels) {
		const kind = GMAIL_LABEL_FOLDER_MAP[label.providerRef];
		if (kind) {
			folders.push({
				providerRef: label.providerRef,
				kind,
				name: label.name,
				isSelectable: true,
				providerStatePayload: {
					kind,
					labelId: label.providerRef,
					labelName: label.path ?? label.name,
				},
			});
		}
	}
	return folders;
}
