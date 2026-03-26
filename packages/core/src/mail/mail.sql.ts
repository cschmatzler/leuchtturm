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

import { user } from "@chevrotain/core/auth/auth.sql";

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
		messageCount: integer("message_count").notNull().default(0),
		unreadCount: integer("unread_count").notNull().default(0),
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
		conversationId: char("conversation_id", { length: 30 }).references(
			() => mailConversation.id,
			{ onDelete: "set null" },
		),
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
	],
);

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
// §11.11 mail_sync_cursor (backend-only, NOT in Zero)
// ---------------------------------------------------------------------------

export const mailSyncCursor = pgTable(
	"mail_sync_cursor",
	{
		id: char("id", { length: 30 }).primaryKey(),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		folderId: char("folder_id", { length: 30 }).references(() => mailFolder.id, {
			onDelete: "cascade",
		}),
		provider: text("provider").notNull(),
		cursorKind: text("cursor_kind").notNull(), // "gmail_history" | "imap_uid" | etc.
		cursorPayload: jsonb("cursor_payload").notNull(), // provider-specific cursor data
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_sync_cursor_account_id_idx").on(table.accountId),
		index("mail_sync_cursor_folder_id_idx").on(table.folderId),
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


