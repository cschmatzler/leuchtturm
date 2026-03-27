/**
 * Provider adapter boundary (§3.1, §9).
 *
 * Each provider implements this interface. The sync layer calls the adapter
 * to fetch normalized data from the provider, then writes it to the canonical
 * Drizzle schema.
 */

import type { MailFolderKind, MailLabelKind } from "@chevrotain/core/mail/schema";

// ---------------------------------------------------------------------------
// Normalized types returned by provider adapters
// ---------------------------------------------------------------------------

export interface ProviderEmailAddress {
	readonly name?: string;
	readonly address: string;
}

export interface ProviderFolder {
	readonly providerRef: string;
	readonly kind: MailFolderKind;
	readonly name: string;
	readonly path?: string;
	readonly delimiter?: string;
	readonly isSelectable: boolean;
}

export interface ProviderLabel {
	readonly providerRef: string;
	readonly name: string;
	readonly path?: string;
	readonly delimiter?: string;
	readonly color?: string;
	readonly kind: MailLabelKind;
}

export interface ProviderAttachment {
	readonly providerRef?: string;
	readonly filename?: string;
	readonly mimeType?: string;
	readonly size?: number;
	readonly isInline: boolean;
	readonly contentId?: string;
}

export interface ProviderBodyPart {
	readonly contentType: "text/plain" | "text/html";
	readonly content: string;
}

export interface ProviderMessageHeaders {
	readonly replyTo?: ProviderEmailAddress[];
	readonly inReplyTo?: string;
	readonly references?: string;
	readonly listUnsubscribe?: string;
	readonly listUnsubscribePost?: string;
}

export interface ProviderMessage {
	readonly providerRef: string;
	readonly internetMessageId?: string;
	readonly threadRef?: string;
	readonly subject?: string;
	readonly snippet?: string;
	readonly sender?: ProviderEmailAddress;
	readonly toRecipients?: ProviderEmailAddress[];
	readonly ccRecipients?: ProviderEmailAddress[];
	readonly bccRecipients?: ProviderEmailAddress[];
	readonly sentAt?: Date;
	readonly receivedAt?: Date;
	readonly isUnread: boolean;
	readonly isStarred: boolean;
	readonly isDraft: boolean;
	readonly labelRefs?: string[];
	readonly headers?: ProviderMessageHeaders;
	readonly bodyParts: ProviderBodyPart[];
	readonly attachments: ProviderAttachment[];
}

export interface ProviderThread {
	readonly providerRef: string;
	readonly messages: ProviderMessage[];
}

// ---------------------------------------------------------------------------
// Incremental sync changes
// ---------------------------------------------------------------------------

export interface ProviderHistoryChange {
	readonly messagesAdded: ProviderMessage[];
	readonly messagesDeleted: string[]; // provider message refs
	readonly labelsAdded: Array<{ messageRef: string; labelRefs: string[] }>;
	readonly labelsRemoved: Array<{ messageRef: string; labelRefs: string[] }>;
}

// ---------------------------------------------------------------------------
// Provider adapter interface
// ---------------------------------------------------------------------------

export interface MailProviderAdapter {
	/**
	 * Fetch all labels/folders from the provider.
	 */
	listLabels(): Promise<ProviderLabel[]>;

	/**
	 * Fetch threads with recent activity (for bootstrap).
	 * For Gmail: threads with at least one message after cutoff.
	 */
	listRecentThreads(cutoff: Date): Promise<ProviderThread[]>;

	/**
	 * Fetch incremental changes since a cursor.
	 * For Gmail: history.list since startHistoryId.
	 */
	getHistoryChanges(cursor: string): Promise<{
		changes: ProviderHistoryChange;
		newCursor: string;
		cursorExpired: boolean;
	}>;

	/**
	 * Fetch full message details by provider ref.
	 */
	getMessage(providerRef: string): Promise<ProviderMessage>;

	/**
	 * Get the latest sync cursor (e.g. Gmail historyId after a full sync).
	 */
	getLatestCursor(): Promise<string>;
}
