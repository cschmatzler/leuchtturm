import {
	boolean,
	char,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

import { session, user } from "@chevrotain/core/auth/auth.sql";

// ---------------------------------------------------------------------------
// §11.1 mail_account
// ---------------------------------------------------------------------------

export const mailAccount = pgTable(
	"mail_account",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		provider: text("provider").notNull(), // "gmail" | "icloud_imap"
		email: text("email").notNull(),
		displayName: text("display_name"),
		status: text("status").notNull().default("connecting"), // connecting | bootstrapping | healthy | resyncing | degraded | requires_reauth | paused

		// Capability flags (§10)
		supportsThreads: boolean("supports_threads").notNull().default(false),
		supportsLabels: boolean("supports_labels").notNull().default(false),
		supportsPushSync: boolean("supports_push_sync").notNull().default(false),
		supportsOauth: boolean("supports_oauth").notNull().default(false),
		supportsServerSearch: boolean("supports_server_search").notNull().default(false),

		// Coverage and health metadata
		bootstrapCutoffAt: timestamp("bootstrap_cutoff_at"),
		bootstrapCompletedAt: timestamp("bootstrap_completed_at"),
		lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
		lastAttemptedSyncAt: timestamp("last_attempted_sync_at"),
		lastErrorCode: text("last_error_code"),
		lastErrorMessage: text("last_error_message"),
		degradedReason: text("degraded_reason"),

		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_account_user_id_idx").on(table.userId),
		unique("mail_account_user_id_email_uniq").on(table.userId, table.email),
	],
);

// ---------------------------------------------------------------------------
// §11.2 mail_account_secret (backend-only, NOT in Zero)
// ---------------------------------------------------------------------------

export const mailAccountSecret = pgTable("mail_account_secret", {
	accountId: char("account_id", { length: 30 })
		.primaryKey()
		.references(() => mailAccount.id, { onDelete: "cascade" }),
	authKind: text("auth_kind").notNull(), // "oauth2" | "app_password"
	encryptedPayload: text("encrypted_payload").notNull(), // base64(nonce + ciphertext + tag)
	encryptedDek: text("encrypted_dek").notNull(), // base64(nonce + ciphertext + tag)
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at")
		.$onUpdate(() => new Date())
		.notNull(),
});

// ---------------------------------------------------------------------------
// §11.2a mail_oauth_state (backend-only, NOT in Zero)
// ---------------------------------------------------------------------------

export const mailOAuthState = pgTable(
	"mail_oauth_state",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		sessionId: char("session_id", { length: 30 })
			.notNull()
			.references(() => session.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").notNull(),
	},
	(table) => [
		index("mail_oauth_state_user_id_idx").on(table.userId),
		index("mail_oauth_state_session_id_idx").on(table.sessionId),
	],
);

// ---------------------------------------------------------------------------
// §11.3 mail_folder
// ---------------------------------------------------------------------------

export const mailFolder = pgTable(
	"mail_folder",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		providerFolderRef: text("provider_folder_ref").notNull(),
		kind: text("kind").notNull(), // inbox | sent | drafts | trash | spam | archive | all_mail | custom
		name: text("name").notNull(),
		path: text("path"),
		delimiter: text("delimiter"),
		parentId: char("parent_id", { length: 30 }),
		depth: smallint("depth").notNull().default(0),
		sortKey: integer("sort_key"),
		isSelectable: boolean("is_selectable").notNull().default(true),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_folder_user_id_idx").on(table.userId),
		index("mail_folder_account_id_idx").on(table.accountId),
		unique("mail_folder_account_id_provider_ref_uniq").on(table.accountId, table.providerFolderRef),
		unique("mail_folder_ownership_uniq").on(table.id, table.accountId, table.userId),
		index("mail_folder_parent_id_idx").on(table.parentId),
	],
);

// ---------------------------------------------------------------------------
// §11.4 mail_label
// ---------------------------------------------------------------------------

export const mailLabel = pgTable(
	"mail_label",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		providerLabelRef: text("provider_label_ref").notNull(),
		name: text("name").notNull(),
		path: text("path"),
		delimiter: text("delimiter"),
		parentId: char("parent_id", { length: 30 }),
		depth: smallint("depth").notNull().default(0),
		sortKey: integer("sort_key"),
		color: text("color"),
		kind: text("kind").notNull(), // "system" | "user"
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_label_user_id_idx").on(table.userId),
		index("mail_label_account_id_idx").on(table.accountId),
		unique("mail_label_account_id_provider_ref_uniq").on(table.accountId, table.providerLabelRef),
		unique("mail_label_ownership_uniq").on(table.id, table.accountId, table.userId),
		index("mail_label_parent_id_idx").on(table.parentId),
	],
);

// ---------------------------------------------------------------------------
// §11.5 mail_conversation
// ---------------------------------------------------------------------------

export const mailConversation = pgTable(
	"mail_conversation",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		providerConversationRef: text("provider_conversation_ref").notNull(),
		subject: text("subject"),
		snippet: text("snippet"),
		latestMessageAt: timestamp("latest_message_at"),
		latestMessageId: char("latest_message_id", { length: 30 }),
		latestSender: jsonb("latest_sender"), // { name?: string, address: string }
		participantsPreview: jsonb("participants_preview"), // { name?: string, address: string }[]
		messageCount: integer("message_count").notNull().default(0),
		unreadCount: integer("unread_count").notNull().default(0),
		hasAttachments: boolean("has_attachments").notNull().default(false),
		isStarred: boolean("is_starred").notNull().default(false),
		draftCount: integer("draft_count").notNull().default(0),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_conversation_user_id_idx").on(table.userId),
		index("mail_conversation_account_id_idx").on(table.accountId),
		index("mail_conversation_latest_message_at_idx").on(table.latestMessageAt),
		unique("mail_conversation_account_id_provider_ref_uniq").on(
			table.accountId,
			table.providerConversationRef,
		),
		unique("mail_conversation_ownership_uniq").on(table.id, table.accountId, table.userId),
		// Query-shaped index for account thread list
		index("mail_conversation_list_idx").on(table.userId, table.accountId, table.latestMessageAt),
	],
);

// ---------------------------------------------------------------------------
// §11.5a mail_conversation_label (derived projection)
// ---------------------------------------------------------------------------

export const mailConversationLabel = pgTable(
	"mail_conversation_label",
	{
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		conversationId: char("conversation_id", { length: 30 })
			.notNull()
			.references(() => mailConversation.id, { onDelete: "cascade" }),
		labelId: char("label_id", { length: 30 })
			.notNull()
			.references(() => mailLabel.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.labelId] }),
		index("mail_conversation_label_user_id_idx").on(table.userId),
		index("mail_conversation_label_label_id_idx").on(table.labelId),
	],
);

// ---------------------------------------------------------------------------
// §11.5b mail_conversation_folder (derived projection)
// ---------------------------------------------------------------------------

export const mailConversationFolder = pgTable(
	"mail_conversation_folder",
	{
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		conversationId: char("conversation_id", { length: 30 })
			.notNull()
			.references(() => mailConversation.id, { onDelete: "cascade" }),
		folderId: char("folder_id", { length: 30 })
			.notNull()
			.references(() => mailFolder.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.folderId] }),
		index("mail_conversation_folder_user_id_idx").on(table.userId),
		index("mail_conversation_folder_folder_id_idx").on(table.folderId),
	],
);

// ---------------------------------------------------------------------------
// §11.6 mail_message
// ---------------------------------------------------------------------------

export const mailMessage = pgTable(
	"mail_message",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		conversationId: char("conversation_id", { length: 30 }).references(() => mailConversation.id, {
			onDelete: "set null",
		}),
		providerMessageRef: text("provider_message_ref"),
		internetMessageId: text("internet_message_id"),
		subject: text("subject"),
		snippet: text("snippet"),
		sender: jsonb("sender"), // { name?: string, address: string }
		toRecipients: jsonb("to_recipients"), // { name?: string, address: string }[]
		ccRecipients: jsonb("cc_recipients"), // { name?: string, address: string }[]
		bccRecipients: jsonb("bcc_recipients"), // { name?: string, address: string }[]
		sentAt: timestamp("sent_at"),
		receivedAt: timestamp("received_at"),
		isUnread: boolean("is_unread").notNull().default(true),
		isStarred: boolean("is_starred").notNull().default(false),
		isDraft: boolean("is_draft").notNull().default(false),
		hasAttachments: boolean("has_attachments").notNull().default(false),
		hasHtml: boolean("has_html").notNull().default(false),
		hasPlainText: boolean("has_plain_text").notNull().default(false),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_message_user_id_idx").on(table.userId),
		index("mail_message_account_id_idx").on(table.accountId),
		index("mail_message_conversation_id_idx").on(table.conversationId),
		index("mail_message_received_at_idx").on(table.receivedAt),
		unique("mail_message_account_id_provider_ref_uniq").on(
			table.accountId,
			table.providerMessageRef,
		),
		unique("mail_message_ownership_uniq").on(table.id, table.accountId, table.userId),
		// Query-shaped indexes for message list views
		index("mail_message_list_idx").on(table.userId, table.accountId, table.receivedAt),
		index("mail_message_unread_idx").on(table.userId, table.accountId, table.isUnread),
	],
);

// ---------------------------------------------------------------------------
// §11.6a mail_message_header
// ---------------------------------------------------------------------------

export const mailMessageHeader = pgTable("mail_message_header", {
	messageId: char("message_id", { length: 30 })
		.primaryKey()
		.references(() => mailMessage.id, { onDelete: "cascade" }),
	userId: char("user_id", { length: 30 })
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	replyTo: jsonb("reply_to"), // { name?: string, address: string }[]
	inReplyTo: text("in_reply_to"),
	references: text("references"), // space-separated Message-ID list
	listUnsubscribe: text("list_unsubscribe"),
	listUnsubscribePost: text("list_unsubscribe_post"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at")
		.$onUpdate(() => new Date())
		.notNull(),
});

// ---------------------------------------------------------------------------
// §11.7 mail_message_body_part
// ---------------------------------------------------------------------------

export const mailMessageBodyPart = pgTable(
	"mail_message_body_part",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		messageId: char("message_id", { length: 30 })
			.notNull()
			.references(() => mailMessage.id, { onDelete: "cascade" }),
		partIndex: smallint("part_index").notNull(),
		contentType: text("content_type").notNull(), // "text/plain" | "text/html"
		content: text("content").notNull(),
		isPreferredRender: boolean("is_preferred_render").notNull().default(false),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_message_body_part_message_id_idx").on(table.messageId),
		unique("mail_message_body_part_message_id_part_index_uniq").on(
			table.messageId,
			table.partIndex,
		),
	],
);

// ---------------------------------------------------------------------------
// §11.8 mail_message_label
// ---------------------------------------------------------------------------

export const mailMessageLabel = pgTable(
	"mail_message_label",
	{
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		messageId: char("message_id", { length: 30 })
			.notNull()
			.references(() => mailMessage.id, { onDelete: "cascade" }),
		labelId: char("label_id", { length: 30 })
			.notNull()
			.references(() => mailLabel.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.messageId, table.labelId] }),
		index("mail_message_label_user_id_idx").on(table.userId),
		index("mail_message_label_label_id_idx").on(table.labelId),
	],
);

// ---------------------------------------------------------------------------
// §11.9 mail_message_mailbox
// ---------------------------------------------------------------------------

export const mailMessageMailbox = pgTable(
	"mail_message_mailbox",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		messageId: char("message_id", { length: 30 })
			.notNull()
			.references(() => mailMessage.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		folderId: char("folder_id", { length: 30 })
			.notNull()
			.references(() => mailFolder.id, { onDelete: "cascade" }),
		providerFolderRef: text("provider_folder_ref"),
		uidvalidity: integer("uidvalidity"),
		uid: integer("uid"),
		modseq: text("modseq"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_message_mailbox_user_id_idx").on(table.userId),
		index("mail_message_mailbox_message_id_idx").on(table.messageId),
		index("mail_message_mailbox_folder_id_idx").on(table.folderId),
		unique("mail_message_mailbox_message_id_folder_id_uniq").on(table.messageId, table.folderId),
		unique("mail_message_mailbox_imap_identity_uniq").on(
			table.accountId,
			table.folderId,
			table.uidvalidity,
			table.uid,
		),
		// Query-shaped index for folder message list
		index("mail_message_mailbox_folder_list_idx").on(table.userId, table.folderId),
	],
);

// ---------------------------------------------------------------------------
// §11.10 mail_attachment
// ---------------------------------------------------------------------------

export const mailAttachment = pgTable(
	"mail_attachment",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		messageId: char("message_id", { length: 30 })
			.notNull()
			.references(() => mailMessage.id, { onDelete: "cascade" }),
		providerAttachmentRef: text("provider_attachment_ref"),
		filename: text("filename"),
		mimeType: text("mime_type"),
		size: integer("size"),
		isInline: boolean("is_inline").notNull().default(false),
		contentId: text("content_id"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_attachment_user_id_idx").on(table.userId),
		index("mail_attachment_message_id_idx").on(table.messageId),
	],
);

// ---------------------------------------------------------------------------
// §11.11 mail_account_sync_state (backend-only, NOT in Zero)
// ---------------------------------------------------------------------------

export const mailAccountSyncState = pgTable(
	"mail_account_sync_state",
	{
		id: char("id", { length: 30 }).primaryKey(),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		stateKind: text("state_kind").notNull(), // "gmail_history" | "bootstrap" | etc.
		payload: jsonb("payload").notNull(), // provider-specific cursor/state data
		lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
		lastAttemptedSyncAt: timestamp("last_attempted_sync_at"),
		lastErrorCode: text("last_error_code"),
		lastErrorMessage: text("last_error_message"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_account_sync_state_account_id_idx").on(table.accountId),
		unique("mail_account_sync_state_account_kind_uniq").on(table.accountId, table.stateKind),
	],
);

// ---------------------------------------------------------------------------
// §11.11a mail_folder_sync_state (backend-only, NOT in Zero)
// ---------------------------------------------------------------------------

export const mailFolderSyncState = pgTable(
	"mail_folder_sync_state",
	{
		id: char("id", { length: 30 }).primaryKey(),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		folderId: char("folder_id", { length: 30 })
			.notNull()
			.references(() => mailFolder.id, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		stateKind: text("state_kind").notNull(), // "imap_uid" | "imap_idle" | "reconciliation" | etc.
		payload: jsonb("payload").notNull(), // uidvalidity, highest_uid, modseq, idle state, etc.
		lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
		lastAttemptedSyncAt: timestamp("last_attempted_sync_at"),
		lastErrorCode: text("last_error_code"),
		lastErrorMessage: text("last_error_message"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_folder_sync_state_account_id_idx").on(table.accountId),
		index("mail_folder_sync_state_folder_id_idx").on(table.folderId),
		unique("mail_folder_sync_state_folder_kind_uniq").on(
			table.accountId,
			table.folderId,
			table.stateKind,
		),
	],
);

// ---------------------------------------------------------------------------
// §11.11b mail_message_source (backend-only, NOT in Zero)
// ---------------------------------------------------------------------------

export const mailMessageSource = pgTable(
	"mail_message_source",
	{
		id: char("id", { length: 30 }).primaryKey(),
		messageId: char("message_id", { length: 30 })
			.notNull()
			.references(() => mailMessage.id, { onDelete: "cascade" }),
		sourceKind: text("source_kind").notNull(), // "raw_mime" | "gmail_raw_json" | "gmail_full_message" | etc.
		storageKind: text("storage_kind").notNull(), // "postgres" | "s3" | "r2" | "filesystem"
		storageKey: text("storage_key").notNull(),
		contentSha256: text("content_sha256"),
		byteSize: integer("byte_size"),
		parserVersion: text("parser_version"),
		sanitizerVersion: text("sanitizer_version"),
		encryptionMetadata: jsonb("encryption_metadata"), // key_id, algorithm, etc.
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_message_source_message_id_idx").on(table.messageId),
		unique("mail_message_source_message_kind_uniq").on(table.messageId, table.sourceKind),
	],
);

// ---------------------------------------------------------------------------
// §11.12 mail_provider_state (backend-only, NOT in Zero)
// ---------------------------------------------------------------------------

export const mailProviderState = pgTable(
	"mail_provider_state",
	{
		id: char("id", { length: 30 }).primaryKey(),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		objectType: text("object_type").notNull(),
		objectId: text("object_id").notNull(),
		payload: jsonb("payload").notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_provider_state_account_id_idx").on(table.accountId),
		unique("mail_provider_state_account_object_uniq").on(
			table.accountId,
			table.objectType,
			table.objectId,
		),
	],
);
