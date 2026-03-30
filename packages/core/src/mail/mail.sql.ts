import {
	boolean,
	char,
	foreignKey,
	index,
	integer,
	jsonb,
	type PgTableExtraConfigValue,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

import { session, user } from "@chevrotain/core/auth/auth.sql";

/** §11.1 */
export const mailAccount = pgTable(
	"mail_account",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		email: text("email").notNull(),
		displayName: text("display_name"),
		status: text("status").notNull().default("connecting"),
		supportsThreads: boolean("supports_threads").notNull().default(false),
		supportsLabels: boolean("supports_labels").notNull().default(false),
		supportsPushSync: boolean("supports_push_sync").notNull().default(false),
		supportsOauth: boolean("supports_oauth").notNull().default(false),
		supportsServerSearch: boolean("supports_server_search").notNull().default(false),
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
		unique("mail_account_id_user_id_uniq").on(table.id, table.userId),
	],
);

/** §11.2 backend-only */
export const mailAccountSecret = pgTable("mail_account_secret", {
	accountId: char("account_id", { length: 30 })
		.primaryKey()
		.references(() => mailAccount.id, { onDelete: "cascade" }),
	authKind: text("auth_kind").notNull(),
	encryptedPayload: text("encrypted_payload").notNull(),
	encryptedDek: text("encrypted_dek").notNull(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at")
		.$onUpdate(() => new Date())
		.notNull(),
});

/** §11.2a backend-only */
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

/** §11.2b */
export const mailIdentity = pgTable(
	"mail_identity",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 }).notNull(),
		address: text("address").notNull(),
		displayName: text("display_name"),
		isPrimary: boolean("is_primary").notNull().default(false),
		isDefaultSendAs: boolean("is_default_send_as").notNull().default(false),
		providerIdentityRef: text("provider_identity_ref"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_identity_user_id_idx").on(table.userId),
		index("mail_identity_account_id_idx").on(table.accountId),
		unique("mail_identity_account_address_uniq").on(table.accountId, table.address),
		foreignKey({
			name: "mail_identity_account_user_fkey",
			columns: [table.accountId, table.userId],
			foreignColumns: [mailAccount.id, mailAccount.userId],
		}).onDelete("cascade"),
	],
);

/** §11.3 */
export const mailFolder = pgTable(
	"mail_folder",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 }).notNull(),
		providerFolderRef: text("provider_folder_ref").notNull(),
		kind: text("kind").notNull(),
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
		unique("mail_folder_id_account_id_uniq").on(table.id, table.accountId),
		index("mail_folder_parent_id_idx").on(table.parentId),
		foreignKey({
			name: "mail_folder_account_user_fkey",
			columns: [table.accountId, table.userId],
			foreignColumns: [mailAccount.id, mailAccount.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_folder_parent_scope_fkey",
			columns: [table.parentId, table.accountId, table.userId],
			foreignColumns: [table.id, table.accountId, table.userId],
		}).onDelete("set null"),
	],
);

/** §11.4 */
export const mailLabel = pgTable(
	"mail_label",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 }).notNull(),
		providerLabelRef: text("provider_label_ref").notNull(),
		name: text("name").notNull(),
		path: text("path"),
		delimiter: text("delimiter"),
		parentId: char("parent_id", { length: 30 }),
		depth: smallint("depth").notNull().default(0),
		sortKey: integer("sort_key"),
		color: text("color"),
		kind: text("kind").notNull(),
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
		foreignKey({
			name: "mail_label_account_user_fkey",
			columns: [table.accountId, table.userId],
			foreignColumns: [mailAccount.id, mailAccount.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_label_parent_scope_fkey",
			columns: [table.parentId, table.accountId, table.userId],
			foreignColumns: [table.id, table.accountId, table.userId],
		}).onDelete("set null"),
	],
);

/** §11.5 */
export const mailConversation = pgTable(
	"mail_conversation",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 }).notNull(),
		providerConversationRef: text("provider_conversation_ref").notNull(),
		subject: text("subject"),
		snippet: text("snippet"),
		latestMessageAt: timestamp("latest_message_at"),
		latestMessageId: char("latest_message_id", { length: 30 }),
		latestSender: jsonb("latest_sender"),
		participantsPreview: jsonb("participants_preview"),
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
	(table): PgTableExtraConfigValue[] => [
		index("mail_conversation_user_id_idx").on(table.userId),
		index("mail_conversation_account_id_idx").on(table.accountId),
		index("mail_conversation_latest_message_at_idx").on(table.latestMessageAt),
		unique("mail_conversation_account_id_provider_ref_uniq").on(
			table.accountId,
			table.providerConversationRef,
		),
		unique("mail_conversation_ownership_uniq").on(table.id, table.accountId, table.userId),
		foreignKey({
			name: "mail_conversation_account_user_fkey",
			columns: [table.accountId, table.userId],
			foreignColumns: [mailAccount.id, mailAccount.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_conversation_latest_message_id_mail_message_id_fkey",
			columns: [table.latestMessageId],
			foreignColumns: [mailMessage.id],
		}).onDelete("set null"),
		index("mail_conversation_list_idx").on(table.userId, table.accountId, table.latestMessageAt),
	],
);

/** §11.5a derived projection */
export const mailConversationLabel = pgTable(
	"mail_conversation_label",
	{
		accountId: char("account_id", { length: 30 }).notNull(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		conversationId: char("conversation_id", { length: 30 }).notNull(),
		labelId: char("label_id", { length: 30 }).notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.labelId] }),
		index("mail_conversation_label_user_id_idx").on(table.userId),
		index("mail_conversation_label_account_id_idx").on(table.accountId),
		index("mail_conversation_label_label_id_idx").on(table.labelId),
		foreignKey({
			name: "mail_conv_label_conversation_fkey",
			columns: [table.conversationId, table.accountId, table.userId],
			foreignColumns: [mailConversation.id, mailConversation.accountId, mailConversation.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_conv_label_label_fkey",
			columns: [table.labelId, table.accountId, table.userId],
			foreignColumns: [mailLabel.id, mailLabel.accountId, mailLabel.userId],
		}).onDelete("cascade"),
	],
);

/** §11.5b derived projection */
export const mailConversationFolder = pgTable(
	"mail_conversation_folder",
	{
		accountId: char("account_id", { length: 30 }).notNull(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		conversationId: char("conversation_id", { length: 30 }).notNull(),
		folderId: char("folder_id", { length: 30 }).notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.folderId] }),
		index("mail_conversation_folder_user_id_idx").on(table.userId),
		index("mail_conversation_folder_account_id_idx").on(table.accountId),
		index("mail_conversation_folder_folder_id_idx").on(table.folderId),
		foreignKey({
			name: "mail_conv_folder_conversation_fkey",
			columns: [table.conversationId, table.accountId, table.userId],
			foreignColumns: [mailConversation.id, mailConversation.accountId, mailConversation.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_conv_folder_folder_fkey",
			columns: [table.folderId, table.accountId, table.userId],
			foreignColumns: [mailFolder.id, mailFolder.accountId, mailFolder.userId],
		}).onDelete("cascade"),
	],
);

/** §11.6 */
export const mailMessage = pgTable(
	"mail_message",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 }).notNull(),
		conversationId: char("conversation_id", { length: 30 }),
		providerMessageRef: text("provider_message_ref"),
		internetMessageId: text("internet_message_id"),
		subject: text("subject"),
		snippet: text("snippet"),
		sender: jsonb("sender"),
		toRecipients: jsonb("to_recipients"),
		ccRecipients: jsonb("cc_recipients"),
		bccRecipients: jsonb("bcc_recipients"),
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
	(table): PgTableExtraConfigValue[] => [
		index("mail_message_user_id_idx").on(table.userId),
		index("mail_message_account_id_idx").on(table.accountId),
		index("mail_message_conversation_id_idx").on(table.conversationId),
		index("mail_message_received_at_idx").on(table.receivedAt),
		unique("mail_message_account_id_provider_ref_uniq").on(
			table.accountId,
			table.providerMessageRef,
		),
		unique("mail_message_id_user_id_uniq").on(table.id, table.userId),
		unique("mail_message_ownership_uniq").on(table.id, table.accountId, table.userId),
		foreignKey({
			name: "mail_message_account_user_fkey",
			columns: [table.accountId, table.userId],
			foreignColumns: [mailAccount.id, mailAccount.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_message_conversation_scope_fkey",
			columns: [table.conversationId, table.accountId, table.userId],
			foreignColumns: [mailConversation.id, mailConversation.accountId, mailConversation.userId],
		}).onDelete("set null"),
		index("mail_message_list_idx").on(table.userId, table.accountId, table.receivedAt),
		index("mail_message_unread_idx").on(table.userId, table.accountId, table.isUnread),
	],
);

/** §11.6a */
export const mailMessageHeader = pgTable(
	"mail_message_header",
	{
		messageId: char("message_id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		replyTo: jsonb("reply_to"),
		inReplyTo: text("in_reply_to"),
		references: text("references"),
		listUnsubscribe: text("list_unsubscribe"),
		listUnsubscribePost: text("list_unsubscribe_post"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		foreignKey({
			name: "mail_message_header_message_user_fkey",
			columns: [table.messageId, table.userId],
			foreignColumns: [mailMessage.id, mailMessage.userId],
		}).onDelete("cascade"),
	],
);

/** §11.7 */
export const mailMessageBodyPart = pgTable(
	"mail_message_body_part",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		messageId: char("message_id", { length: 30 }).notNull(),
		partIndex: smallint("part_index").notNull(),
		contentType: text("content_type").notNull(),
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
		foreignKey({
			name: "mail_message_body_part_message_user_fkey",
			columns: [table.messageId, table.userId],
			foreignColumns: [mailMessage.id, mailMessage.userId],
		}).onDelete("cascade"),
	],
);

/** §11.8 */
export const mailMessageLabel = pgTable(
	"mail_message_label",
	{
		accountId: char("account_id", { length: 30 }).notNull(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		messageId: char("message_id", { length: 30 }).notNull(),
		labelId: char("label_id", { length: 30 }).notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.messageId, table.labelId] }),
		index("mail_message_label_user_id_idx").on(table.userId),
		index("mail_message_label_account_id_idx").on(table.accountId),
		index("mail_message_label_label_id_idx").on(table.labelId),
		foreignKey({
			name: "mail_message_label_message_fkey",
			columns: [table.messageId, table.accountId, table.userId],
			foreignColumns: [mailMessage.id, mailMessage.accountId, mailMessage.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_message_label_label_fkey",
			columns: [table.labelId, table.accountId, table.userId],
			foreignColumns: [mailLabel.id, mailLabel.accountId, mailLabel.userId],
		}).onDelete("cascade"),
	],
);

/** §11.9 */
export const mailMessageMailbox = pgTable(
	"mail_message_mailbox",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		messageId: char("message_id", { length: 30 }).notNull(),
		accountId: char("account_id", { length: 30 }).notNull(),
		folderId: char("folder_id", { length: 30 }).notNull(),
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
		foreignKey({
			name: "mail_message_mailbox_message_fkey",
			columns: [table.messageId, table.accountId, table.userId],
			foreignColumns: [mailMessage.id, mailMessage.accountId, mailMessage.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_message_mailbox_folder_fkey",
			columns: [table.folderId, table.accountId, table.userId],
			foreignColumns: [mailFolder.id, mailFolder.accountId, mailFolder.userId],
		}).onDelete("cascade"),
		index("mail_message_mailbox_folder_list_idx").on(table.userId, table.folderId),
	],
);

/** §11.10 */
export const mailAttachment = pgTable(
	"mail_attachment",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		messageId: char("message_id", { length: 30 }).notNull(),
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
		foreignKey({
			name: "mail_attachment_message_user_fkey",
			columns: [table.messageId, table.userId],
			foreignColumns: [mailMessage.id, mailMessage.userId],
		}).onDelete("cascade"),
	],
);

/** §11.11 backend-only */
export const mailAccountSyncState = pgTable(
	"mail_account_sync_state",
	{
		id: char("id", { length: 30 }).primaryKey(),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		stateKind: text("state_kind").notNull(),
		payload: jsonb("payload").notNull(),
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

/** §11.11a backend-only */
export const mailFolderSyncState = pgTable(
	"mail_folder_sync_state",
	{
		id: char("id", { length: 30 }).primaryKey(),
		accountId: char("account_id", { length: 30 })
			.notNull()
			.references(() => mailAccount.id, { onDelete: "cascade" }),
		folderId: char("folder_id", { length: 30 }).notNull(),
		provider: text("provider").notNull(),
		stateKind: text("state_kind").notNull(),
		payload: jsonb("payload").notNull(),
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
		foreignKey({
			name: "mail_folder_sync_state_folder_scope_fkey",
			columns: [table.folderId, table.accountId],
			foreignColumns: [mailFolder.id, mailFolder.accountId],
		}).onDelete("cascade"),
	],
);

/** §11.10 */
export const mailParticipant = pgTable(
	"mail_participant",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		normalizedAddress: text("normalized_address").notNull(),
		displayName: text("display_name"),
		lastSeenAt: timestamp("last_seen_at"),
		sourceKind: text("source_kind").notNull().default("derived_from_mail"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_participant_user_id_idx").on(table.userId),
		unique("mail_participant_id_user_id_uniq").on(table.id, table.userId),
		unique("mail_participant_user_address_uniq").on(table.userId, table.normalizedAddress),
	],
);

/** §11.10a */
export const mailMessageParticipant = pgTable(
	"mail_message_participant",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		messageId: char("message_id", { length: 30 }).notNull(),
		participantId: char("participant_id", { length: 30 }).notNull(),
		role: text("role").notNull(),
		ordinal: smallint("ordinal").notNull().default(0),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_message_participant_user_id_idx").on(table.userId),
		index("mail_message_participant_message_id_idx").on(table.messageId),
		index("mail_message_participant_participant_id_idx").on(table.participantId),
		unique("mail_message_participant_unique").on(table.messageId, table.participantId, table.role),
		foreignKey({
			name: "mail_message_participant_message_fkey",
			columns: [table.messageId, table.userId],
			foreignColumns: [mailMessage.id, mailMessage.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_message_participant_participant_fkey",
			columns: [table.participantId, table.userId],
			foreignColumns: [mailParticipant.id, mailParticipant.userId],
		}).onDelete("cascade"),
	],
);

/** §11.10b backend-only */
export const mailSearchDocument = pgTable(
	"mail_search_document",
	{
		messageId: char("message_id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: char("account_id", { length: 30 }).notNull(),
		conversationId: char("conversation_id", { length: 30 }),
		folderIds: jsonb("folder_ids"),
		labelIds: jsonb("label_ids"),
		subjectText: text("subject_text"),
		senderText: text("sender_text"),
		recipientText: text("recipient_text"),
		bodyText: text("body_text"),
		snippetText: text("snippet_text"),
		mirroredCoverageKind: text("mirrored_coverage_kind").notNull().default("full_thread"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("mail_search_document_account_id_idx").on(table.accountId),
		index("mail_search_document_user_id_idx").on(table.userId),
		index("mail_search_document_conversation_id_idx").on(table.conversationId),
		foreignKey({
			name: "mail_search_document_message_scope_fkey",
			columns: [table.messageId, table.accountId, table.userId],
			foreignColumns: [mailMessage.id, mailMessage.accountId, mailMessage.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_search_document_account_user_fkey",
			columns: [table.accountId, table.userId],
			foreignColumns: [mailAccount.id, mailAccount.userId],
		}).onDelete("cascade"),
		foreignKey({
			name: "mail_search_document_conversation_scope_fkey",
			columns: [table.conversationId, table.accountId, table.userId],
			foreignColumns: [mailConversation.id, mailConversation.accountId, mailConversation.userId],
		}),
	],
);

/** §11.10b backend-only */
export const mailMessageSource = pgTable(
	"mail_message_source",
	{
		id: char("id", { length: 30 }).primaryKey(),
		messageId: char("message_id", { length: 30 })
			.notNull()
			.references(() => mailMessage.id, { onDelete: "cascade" }),
		sourceKind: text("source_kind").notNull(),
		storageKind: text("storage_kind").notNull(),
		storageKey: text("storage_key").notNull(),
		contentSha256: text("content_sha256"),
		byteSize: integer("byte_size"),
		parserVersion: text("parser_version"),
		sanitizerVersion: text("sanitizer_version"),
		encryptionMetadata: jsonb("encryption_metadata"),
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

/** §11.12 backend-only */
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
