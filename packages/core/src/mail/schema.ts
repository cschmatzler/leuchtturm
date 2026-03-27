import { Schema } from "effect";
import { ulid } from "ulid";

import { Ulid } from "@chevrotain/core/schema";

// ---------------------------------------------------------------------------
// ID types
// ---------------------------------------------------------------------------

export const MailAccountId = Schema.TemplateLiteral(["mac_", Ulid]).pipe(
	Schema.brand("MailAccountId"),
);
export type MailAccountId = typeof MailAccountId.Type;

export const MailFolderId = Schema.TemplateLiteral(["mfl_", Ulid]).pipe(
	Schema.brand("MailFolderId"),
);
export type MailFolderId = typeof MailFolderId.Type;

export const MailLabelId = Schema.TemplateLiteral(["mlb_", Ulid]).pipe(Schema.brand("MailLabelId"));
export type MailLabelId = typeof MailLabelId.Type;

export const MailConversationId = Schema.TemplateLiteral(["mcv_", Ulid]).pipe(
	Schema.brand("MailConversationId"),
);
export type MailConversationId = typeof MailConversationId.Type;

export const MailMessageId = Schema.TemplateLiteral(["mmg_", Ulid]).pipe(
	Schema.brand("MailMessageId"),
);
export type MailMessageId = typeof MailMessageId.Type;

export const MailMessageBodyPartId = Schema.TemplateLiteral(["mbp_", Ulid]).pipe(
	Schema.brand("MailMessageBodyPartId"),
);
export type MailMessageBodyPartId = typeof MailMessageBodyPartId.Type;

export const MailMessageMailboxId = Schema.TemplateLiteral(["mmb_", Ulid]).pipe(
	Schema.brand("MailMessageMailboxId"),
);
export type MailMessageMailboxId = typeof MailMessageMailboxId.Type;

export const MailAttachmentId = Schema.TemplateLiteral(["mat_", Ulid]).pipe(
	Schema.brand("MailAttachmentId"),
);
export type MailAttachmentId = typeof MailAttachmentId.Type;

export const MailAccountSyncStateId = Schema.TemplateLiteral(["mas_", Ulid]).pipe(
	Schema.brand("MailAccountSyncStateId"),
);
export type MailAccountSyncStateId = typeof MailAccountSyncStateId.Type;

export const MailFolderSyncStateId = Schema.TemplateLiteral(["mfs_", Ulid]).pipe(
	Schema.brand("MailFolderSyncStateId"),
);
export type MailFolderSyncStateId = typeof MailFolderSyncStateId.Type;

export const MailMessageSourceId = Schema.TemplateLiteral(["mms_", Ulid]).pipe(
	Schema.brand("MailMessageSourceId"),
);
export type MailMessageSourceId = typeof MailMessageSourceId.Type;

export const MailProviderStateId = Schema.TemplateLiteral(["mps_", Ulid]).pipe(
	Schema.brand("MailProviderStateId"),
);
export type MailProviderStateId = typeof MailProviderStateId.Type;

export const MailOAuthStateId = Schema.TemplateLiteral(["mos_", Ulid]).pipe(
	Schema.brand("MailOAuthStateId"),
);
export type MailOAuthStateId = typeof MailOAuthStateId.Type;

export function createMailAccountId(): MailAccountId {
	return MailAccountId.makeUnsafe(`mac_${ulid()}`);
}

export function createMailFolderId(): MailFolderId {
	return MailFolderId.makeUnsafe(`mfl_${ulid()}`);
}

export function createMailLabelId(): MailLabelId {
	return MailLabelId.makeUnsafe(`mlb_${ulid()}`);
}

export function createMailConversationId(): MailConversationId {
	return MailConversationId.makeUnsafe(`mcv_${ulid()}`);
}

export function createMailMessageId(): MailMessageId {
	return MailMessageId.makeUnsafe(`mmg_${ulid()}`);
}

export function createMailMessageBodyPartId(): MailMessageBodyPartId {
	return MailMessageBodyPartId.makeUnsafe(`mbp_${ulid()}`);
}

export function createMailMessageMailboxId(): MailMessageMailboxId {
	return MailMessageMailboxId.makeUnsafe(`mmb_${ulid()}`);
}

export function createMailAttachmentId(): MailAttachmentId {
	return MailAttachmentId.makeUnsafe(`mat_${ulid()}`);
}

export function createMailAccountSyncStateId(): MailAccountSyncStateId {
	return MailAccountSyncStateId.makeUnsafe(`mas_${ulid()}`);
}

export function createMailFolderSyncStateId(): MailFolderSyncStateId {
	return MailFolderSyncStateId.makeUnsafe(`mfs_${ulid()}`);
}

export function createMailMessageSourceId(): MailMessageSourceId {
	return MailMessageSourceId.makeUnsafe(`mms_${ulid()}`);
}

export function createMailProviderStateId(): MailProviderStateId {
	return MailProviderStateId.makeUnsafe(`mps_${ulid()}`);
}

export function createMailOAuthStateId(): MailOAuthStateId {
	return MailOAuthStateId.makeUnsafe(`mos_${ulid()}`);
}

// ---------------------------------------------------------------------------
// Stored secret shape (encrypted in mail_account_secret)
// ---------------------------------------------------------------------------

export const StoredMailOAuthSecret = Schema.Struct({
	accessToken: Schema.String,
	refreshToken: Schema.optional(Schema.String),
	expiresAt: Schema.Number,
});
export type StoredMailOAuthSecret = typeof StoredMailOAuthSecret.Type;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type MailProvider = "gmail" | "icloud_imap";

export type MailAccountStatus =
	| "connecting"
	| "bootstrapping"
	| "healthy"
	| "resyncing"
	| "degraded"
	| "requires_reauth"
	| "paused";

export type MailFolderKind =
	| "inbox"
	| "sent"
	| "drafts"
	| "trash"
	| "spam"
	| "archive"
	| "all_mail"
	| "custom";

export type MailLabelKind = "system" | "user";

export type MailAuthKind = "oauth2" | "app_password";

export type MailSourceKind = "raw_mime" | "gmail_raw_json" | "gmail_full_message";

export type MailStorageKind = "postgres" | "s3" | "r2" | "filesystem";

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

export const EmailAddress = Schema.Struct({
	name: Schema.optional(Schema.String),
	address: Schema.String,
});
export type EmailAddress = typeof EmailAddress.Type;

// ---------------------------------------------------------------------------
// Provider capability matrix (§10)
// ---------------------------------------------------------------------------

export interface ProviderCapabilities {
	readonly supportsThreads: boolean;
	readonly supportsLabels: boolean;
	readonly supportsPushSync: boolean;
	readonly supportsOauth: boolean;
	readonly supportsServerSearch: boolean;
}

export const GMAIL_CAPABILITIES: ProviderCapabilities = {
	supportsThreads: true,
	supportsLabels: true,
	supportsPushSync: true,
	supportsOauth: true,
	supportsServerSearch: true,
};

export const ICLOUD_IMAP_CAPABILITIES: ProviderCapabilities = {
	supportsThreads: false,
	supportsLabels: false,
	supportsPushSync: false,
	supportsOauth: false,
	supportsServerSearch: false,
};

export function getProviderCapabilities(provider: MailProvider): ProviderCapabilities {
	switch (provider) {
		case "gmail":
			return GMAIL_CAPABILITIES;
		case "icloud_imap":
			return ICLOUD_IMAP_CAPABILITIES;
	}
}

// ---------------------------------------------------------------------------
// Gmail label → folder mapping (§25.1)
// ---------------------------------------------------------------------------

const GMAIL_SYSTEM_LABEL_TO_FOLDER_KIND: Partial<Record<string, MailFolderKind>> = {
	INBOX: "inbox",
	SENT: "sent",
	DRAFT: "drafts",
	TRASH: "trash",
	SPAM: "spam",
	UNREAD: "inbox", // not a folder
	STARRED: "inbox", // not a folder
	IMPORTANT: "inbox", // not a folder
};

const GMAIL_FOLDER_LABELS = new Set(["INBOX", "SENT", "DRAFT", "TRASH", "SPAM"]);

export function gmailLabelToFolderKind(labelId: string): MailFolderKind | undefined {
	if (GMAIL_FOLDER_LABELS.has(labelId)) {
		return GMAIL_SYSTEM_LABEL_TO_FOLDER_KIND[labelId];
	}
	return undefined;
}
