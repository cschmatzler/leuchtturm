import { Schema } from "effect";
import { ulid } from "ulid";

import { SessionId, UserId } from "@leuchtturm/core/auth/schema";
import { Email, Ulid } from "@leuchtturm/core/schema";

const NullableString = Schema.NullOr(Schema.String);

export const MailAccountId = Schema.TemplateLiteral(["mac_", Ulid]).pipe(
	Schema.brand("MailAccountId"),
);
export type MailAccountId = typeof MailAccountId.Type;

export const MailIdentityId = Schema.TemplateLiteral(["mid_", Ulid]).pipe(
	Schema.brand("MailIdentityId"),
);
export type MailIdentityId = typeof MailIdentityId.Type;

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

export const MailParticipantId = Schema.TemplateLiteral(["mpt_", Ulid]).pipe(
	Schema.brand("MailParticipantId"),
);
export type MailParticipantId = typeof MailParticipantId.Type;

export const MailMessageParticipantId = Schema.TemplateLiteral(["mmp_", Ulid]).pipe(
	Schema.brand("MailMessageParticipantId"),
);
export type MailMessageParticipantId = typeof MailMessageParticipantId.Type;

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

export function createMailIdentityId(): MailIdentityId {
	return MailIdentityId.makeUnsafe(`mid_${ulid()}`);
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

export function createMailParticipantId(): MailParticipantId {
	return MailParticipantId.makeUnsafe(`mpt_${ulid()}`);
}

export function createMailMessageParticipantId(): MailMessageParticipantId {
	return MailMessageParticipantId.makeUnsafe(`mmp_${ulid()}`);
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

export const StoredMailOAuthSecret = Schema.Struct({
	accessToken: Schema.String,
	refreshToken: Schema.optional(Schema.String),
	expiresAt: Schema.Number,
});
export type StoredMailOAuthSecret = typeof StoredMailOAuthSecret.Type;

export const MailProvider = Schema.Literals(["gmail", "icloud_imap"]);
export type MailProvider = typeof MailProvider.Type;

export const MailAccountStatus = Schema.Literals([
	"connecting",
	"bootstrapping",
	"healthy",
	"resyncing",
	"degraded",
	"requires_reauth",
	"paused",
]);
export type MailAccountStatus = typeof MailAccountStatus.Type;

export const MailFolderKind = Schema.Literals([
	"inbox",
	"sent",
	"drafts",
	"trash",
	"spam",
	"archive",
	"all_mail",
	"custom",
]);
export type MailFolderKind = typeof MailFolderKind.Type;

export const MailLabelKind = Schema.Literals(["system", "user"]);
export type MailLabelKind = typeof MailLabelKind.Type;

export const MailAuthKind = Schema.Literals(["oauth2", "app_password"]);
export type MailAuthKind = typeof MailAuthKind.Type;

export const MailSourceKind = Schema.Literals(["raw_mime", "gmail_full_message", "render_bundle"]);
export type MailSourceKind = typeof MailSourceKind.Type;

export const MailStorageKind = Schema.Literals(["postgres", "s3", "r2", "filesystem"]);
export type MailStorageKind = typeof MailStorageKind.Type;

export const MailMirroredCoverageKind = Schema.Literals([
	"full_thread",
	"recent_only",
	"headers_only",
]);
export type MailMirroredCoverageKind = typeof MailMirroredCoverageKind.Type;

export const MailParticipantSourceKind = Schema.Literals([
	"derived_from_mail",
	"imported_contact",
	"user_edited",
]);
export type MailParticipantSourceKind = typeof MailParticipantSourceKind.Type;

export const MailParticipantRole = Schema.Literals(["from", "to", "cc", "bcc", "reply_to"]);
export type MailParticipantRole = typeof MailParticipantRole.Type;

export const EmailAddress = Schema.Struct({
	name: Schema.optional(Schema.String),
	address: Schema.String,
});
export type EmailAddress = typeof EmailAddress.Type;

export const CreateMailAccountInput = Schema.Struct({
	id: MailAccountId,
	userId: UserId,
	provider: MailProvider,
	email: Email,
	displayName: NullableString,
	status: MailAccountStatus,
});
export type CreateMailAccountInput = typeof CreateMailAccountInput.Type;

export const CreateMailAccountSecretInput = Schema.Struct({
	accountId: MailAccountId,
	authKind: MailAuthKind,
	encryptedPayload: Schema.String,
	encryptedDek: Schema.String,
});
export type CreateMailAccountSecretInput = typeof CreateMailAccountSecretInput.Type;

export const UpdateMailAccountSecretInput = Schema.Struct({
	encryptedPayload: Schema.String,
	encryptedDek: Schema.String,
});
export type UpdateMailAccountSecretInput = typeof UpdateMailAccountSecretInput.Type;

export const CreateMailOAuthStateInput = Schema.Struct({
	id: MailOAuthStateId,
	userId: UserId,
	sessionId: SessionId,
	expiresAt: Schema.Date,
});
export type CreateMailOAuthStateInput = typeof CreateMailOAuthStateInput.Type;

const mailConversationValueFields = {
	subject: NullableString,
	snippet: NullableString,
	latestMessageAt: Schema.Date,
	latestMessageId: Schema.NullOr(MailMessageId),
	latestSender: Schema.NullOr(EmailAddress),
	participantsPreview: Schema.NullOr(Schema.Array(EmailAddress)),
	messageCount: Schema.Number,
	unreadCount: Schema.Number,
	hasAttachments: Schema.Boolean,
	isStarred: Schema.Boolean,
	draftCount: Schema.Number,
	updatedAt: Schema.Date,
} as const;

export const MailConversationValues = Schema.Struct(mailConversationValueFields);
export type MailConversationValues = typeof MailConversationValues.Type;

export const MailConversation = Schema.Struct({
	id: MailConversationId,
	userId: UserId,
	accountId: MailAccountId,
	providerConversationRef: Schema.String,
	...mailConversationValueFields,
	createdAt: Schema.Date,
});
export type MailConversation = typeof MailConversation.Type;

const mailSearchDocumentValueFields = {
	conversationId: Schema.NullOr(MailConversationId),
	folderIds: Schema.NullOr(Schema.Array(MailFolderId)),
	labelIds: Schema.NullOr(Schema.Array(MailLabelId)),
	subjectText: NullableString,
	senderText: NullableString,
	recipientText: NullableString,
	bodyText: NullableString,
	snippetText: NullableString,
	mirroredCoverageKind: MailMirroredCoverageKind,
	updatedAt: Schema.Date,
} as const;

export const MailSearchDocumentValues = Schema.Struct(mailSearchDocumentValueFields);
export type MailSearchDocumentValues = typeof MailSearchDocumentValues.Type;

export const MailSearchDocument = Schema.Struct({
	messageId: MailMessageId,
	userId: UserId,
	accountId: MailAccountId,
	...mailSearchDocumentValueFields,
	createdAt: Schema.Date,
});
export type MailSearchDocument = typeof MailSearchDocument.Type;

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

const GMAIL_SYSTEM_LABEL_TO_FOLDER_KIND: Partial<Record<string, MailFolderKind>> = {
	INBOX: "inbox",
	SENT: "sent",
	DRAFT: "drafts",
	TRASH: "trash",
	SPAM: "spam",
	UNREAD: "inbox",
	STARRED: "inbox",
	IMPORTANT: "inbox",
};

const GMAIL_FOLDER_LABELS = new Set(["INBOX", "SENT", "DRAFT", "TRASH", "SPAM"]);

export function gmailLabelToFolderKind(labelId: string): MailFolderKind | undefined {
	if (GMAIL_FOLDER_LABELS.has(labelId)) {
		return GMAIL_SYSTEM_LABEL_TO_FOLDER_KIND[labelId];
	}
	return undefined;
}
