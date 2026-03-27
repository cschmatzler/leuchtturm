import {
	boolean,
	createBuilder,
	createSchema,
	json,
	number,
	relationships,
	string,
	table,
	type Row,
	type Zero,
} from "@rocicorp/zero";

import { type SupportedLanguage } from "@chevrotain/core/i18n";

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const user = table("user")
	.columns({
		id: string(),
		name: string(),
		email: string(),
		language: string<SupportedLanguage>().optional(),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const mailAccount = table("mail_account")
	.columns({
		id: string(),
		userId: string().from("user_id"),
		provider: string(),
		email: string(),
		displayName: string().from("display_name").optional(),
		status: string(),
		supportsThreads: boolean().from("supports_threads"),
		supportsLabels: boolean().from("supports_labels"),
		supportsPushSync: boolean().from("supports_push_sync"),
		supportsOauth: boolean().from("supports_oauth"),
		supportsServerSearch: boolean().from("supports_server_search"),
		bootstrapCutoffAt: number().from("bootstrap_cutoff_at").optional(),
		bootstrapCompletedAt: number().from("bootstrap_completed_at").optional(),
		lastSuccessfulSyncAt: number().from("last_successful_sync_at").optional(),
		lastAttemptedSyncAt: number().from("last_attempted_sync_at").optional(),
		lastErrorCode: string().from("last_error_code").optional(),
		lastErrorMessage: string().from("last_error_message").optional(),
		degradedReason: string().from("degraded_reason").optional(),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const mailIdentity = table("mail_identity")
	.columns({
		id: string(),
		userId: string().from("user_id"),
		accountId: string().from("account_id"),
		address: string(),
		displayName: string().from("display_name").optional(),
		isPrimary: boolean().from("is_primary"),
		isDefaultSendAs: boolean().from("is_default_send_as"),
		providerIdentityRef: string().from("provider_identity_ref").optional(),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const mailFolder = table("mail_folder")
	.columns({
		id: string(),
		userId: string().from("user_id"),
		accountId: string().from("account_id"),
		providerFolderRef: string().from("provider_folder_ref"),
		kind: string(),
		name: string(),
		path: string().optional(),
		delimiter: string().optional(),
		parentId: string().from("parent_id").optional(),
		depth: number(),
		sortKey: number().from("sort_key").optional(),
		isSelectable: boolean().from("is_selectable"),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const mailLabel = table("mail_label")
	.columns({
		id: string(),
		userId: string().from("user_id"),
		accountId: string().from("account_id"),
		providerLabelRef: string().from("provider_label_ref"),
		name: string(),
		path: string().optional(),
		delimiter: string().optional(),
		parentId: string().from("parent_id").optional(),
		depth: number(),
		sortKey: number().from("sort_key").optional(),
		color: string().optional(),
		kind: string(),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const mailConversation = table("mail_conversation")
	.columns({
		id: string(),
		userId: string().from("user_id"),
		accountId: string().from("account_id"),
		providerConversationRef: string().from("provider_conversation_ref"),
		subject: string().optional(),
		snippet: string().optional(),
		latestMessageAt: number().from("latest_message_at").optional(),
		latestMessageId: string().from("latest_message_id").optional(),
		latestSender: json<EmailAddress>().from("latest_sender").optional(),
		participantsPreview: json<EmailAddress[]>().from("participants_preview").optional(),
		messageCount: number().from("message_count"),
		unreadCount: number().from("unread_count"),
		hasAttachments: boolean().from("has_attachments"),
		isStarred: boolean().from("is_starred"),
		draftCount: number().from("draft_count"),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const mailConversationLabel = table("mail_conversation_label")
	.columns({
		userId: string().from("user_id"),
		conversationId: string().from("conversation_id"),
		labelId: string().from("label_id"),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("conversationId", "labelId");

const mailConversationFolder = table("mail_conversation_folder")
	.columns({
		userId: string().from("user_id"),
		conversationId: string().from("conversation_id"),
		folderId: string().from("folder_id"),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("conversationId", "folderId");

type EmailAddress = { name?: string; address: string };

const mailMessage = table("mail_message")
	.columns({
		id: string(),
		userId: string().from("user_id"),
		accountId: string().from("account_id"),
		conversationId: string().from("conversation_id").optional(),
		providerMessageRef: string().from("provider_message_ref").optional(),
		internetMessageId: string().from("internet_message_id").optional(),
		subject: string().optional(),
		snippet: string().optional(),
		sender: json<EmailAddress>().optional(),
		toRecipients: json<EmailAddress[]>().from("to_recipients").optional(),
		ccRecipients: json<EmailAddress[]>().from("cc_recipients").optional(),
		bccRecipients: json<EmailAddress[]>().from("bcc_recipients").optional(),
		sentAt: number().from("sent_at").optional(),
		receivedAt: number().from("received_at").optional(),
		isUnread: boolean().from("is_unread"),
		isStarred: boolean().from("is_starred"),
		isDraft: boolean().from("is_draft"),
		hasAttachments: boolean().from("has_attachments"),
		hasHtml: boolean().from("has_html"),
		hasPlainText: boolean().from("has_plain_text"),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const mailMessageHeader = table("mail_message_header")
	.columns({
		messageId: string().from("message_id"),
		userId: string().from("user_id"),
		replyTo: json<EmailAddress[]>().from("reply_to").optional(),
		inReplyTo: string().from("in_reply_to").optional(),
		references: string().optional(),
		listUnsubscribe: string().from("list_unsubscribe").optional(),
		listUnsubscribePost: string().from("list_unsubscribe_post").optional(),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("messageId");

const mailMessageBodyPart = table("mail_message_body_part")
	.columns({
		id: string(),
		userId: string().from("user_id"),
		messageId: string().from("message_id"),
		partIndex: number().from("part_index"),
		contentType: string().from("content_type"),
		content: string(),
		isPreferredRender: boolean().from("is_preferred_render"),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const mailMessageLabel = table("mail_message_label")
	.columns({
		userId: string().from("user_id"),
		messageId: string().from("message_id"),
		labelId: string().from("label_id"),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("messageId", "labelId");

const mailMessageMailbox = table("mail_message_mailbox")
	.columns({
		id: string(),
		userId: string().from("user_id"),
		messageId: string().from("message_id"),
		accountId: string().from("account_id"),
		folderId: string().from("folder_id"),
		providerFolderRef: string().from("provider_folder_ref").optional(),
		uidvalidity: number().optional(),
		uid: number().optional(),
		modseq: string().optional(),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const mailAttachment = table("mail_attachment")
	.columns({
		id: string(),
		userId: string().from("user_id"),
		messageId: string().from("message_id"),
		providerAttachmentRef: string().from("provider_attachment_ref").optional(),
		filename: string().optional(),
		mimeType: string().from("mime_type").optional(),
		size: number().optional(),
		isInline: boolean().from("is_inline"),
		contentId: string().from("content_id").optional(),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

const userMailAccounts = relationships(user, ({ many }) => ({
	mailAccounts: many({
		sourceField: ["id"],
		destField: ["userId"],
		destSchema: mailAccount,
	}),
}));

const mailIdentityRelationships = relationships(mailIdentity, ({ one }) => ({
	account: one({
		sourceField: ["accountId"],
		destField: ["id"],
		destSchema: mailAccount,
	}),
}));

const mailAccountRelationships = relationships(mailAccount, ({ one, many }) => ({
	user: one({
		sourceField: ["userId"],
		destField: ["id"],
		destSchema: user,
	}),
	identities: many({
		sourceField: ["id"],
		destField: ["accountId"],
		destSchema: mailIdentity,
	}),
	folders: many({
		sourceField: ["id"],
		destField: ["accountId"],
		destSchema: mailFolder,
	}),
	labels: many({
		sourceField: ["id"],
		destField: ["accountId"],
		destSchema: mailLabel,
	}),
	conversations: many({
		sourceField: ["id"],
		destField: ["accountId"],
		destSchema: mailConversation,
	}),
	messages: many({
		sourceField: ["id"],
		destField: ["accountId"],
		destSchema: mailMessage,
	}),
}));

const mailFolderRelationships = relationships(mailFolder, ({ one, many }) => ({
	account: one({
		sourceField: ["accountId"],
		destField: ["id"],
		destSchema: mailAccount,
	}),
	mailboxEntries: many({
		sourceField: ["id"],
		destField: ["folderId"],
		destSchema: mailMessageMailbox,
	}),
}));

const mailLabelRelationships = relationships(mailLabel, ({ one, many }) => ({
	account: one({
		sourceField: ["accountId"],
		destField: ["id"],
		destSchema: mailAccount,
	}),
	messageLabels: many({
		sourceField: ["id"],
		destField: ["labelId"],
		destSchema: mailMessageLabel,
	}),
}));

const mailConversationRelationships = relationships(mailConversation, ({ one, many }) => ({
	account: one({
		sourceField: ["accountId"],
		destField: ["id"],
		destSchema: mailAccount,
	}),
	messages: many({
		sourceField: ["id"],
		destField: ["conversationId"],
		destSchema: mailMessage,
	}),
	labels: many(
		{
			sourceField: ["id"],
			destField: ["conversationId"],
			destSchema: mailConversationLabel,
		},
		{
			sourceField: ["labelId"],
			destField: ["id"],
			destSchema: mailLabel,
		},
	),
	folders: many(
		{
			sourceField: ["id"],
			destField: ["conversationId"],
			destSchema: mailConversationFolder,
		},
		{
			sourceField: ["folderId"],
			destField: ["id"],
			destSchema: mailFolder,
		},
	),
}));

const mailConversationLabelRelationships = relationships(mailConversationLabel, ({ one }) => ({
	conversation: one({
		sourceField: ["conversationId"],
		destField: ["id"],
		destSchema: mailConversation,
	}),
	label: one({
		sourceField: ["labelId"],
		destField: ["id"],
		destSchema: mailLabel,
	}),
}));

const mailConversationFolderRelationships = relationships(mailConversationFolder, ({ one }) => ({
	conversation: one({
		sourceField: ["conversationId"],
		destField: ["id"],
		destSchema: mailConversation,
	}),
	folder: one({
		sourceField: ["folderId"],
		destField: ["id"],
		destSchema: mailFolder,
	}),
}));

const mailMessageHeaderRelationships = relationships(mailMessageHeader, ({ one }) => ({
	message: one({
		sourceField: ["messageId"],
		destField: ["id"],
		destSchema: mailMessage,
	}),
}));

const mailMessageRelationships = relationships(mailMessage, ({ one, many }) => ({
	account: one({
		sourceField: ["accountId"],
		destField: ["id"],
		destSchema: mailAccount,
	}),
	conversation: one({
		sourceField: ["conversationId"],
		destField: ["id"],
		destSchema: mailConversation,
	}),
	bodyParts: many({
		sourceField: ["id"],
		destField: ["messageId"],
		destSchema: mailMessageBodyPart,
	}),
	header: one({
		sourceField: ["id"],
		destField: ["messageId"],
		destSchema: mailMessageHeader,
	}),
	labels: many(
		{
			sourceField: ["id"],
			destField: ["messageId"],
			destSchema: mailMessageLabel,
		},
		{
			sourceField: ["labelId"],
			destField: ["id"],
			destSchema: mailLabel,
		},
	),
	mailboxEntries: many({
		sourceField: ["id"],
		destField: ["messageId"],
		destSchema: mailMessageMailbox,
	}),
	attachments: many({
		sourceField: ["id"],
		destField: ["messageId"],
		destSchema: mailAttachment,
	}),
}));

const mailMessageBodyPartRelationships = relationships(mailMessageBodyPart, ({ one }) => ({
	message: one({
		sourceField: ["messageId"],
		destField: ["id"],
		destSchema: mailMessage,
	}),
}));

const mailMessageLabelRelationships = relationships(mailMessageLabel, ({ one }) => ({
	message: one({
		sourceField: ["messageId"],
		destField: ["id"],
		destSchema: mailMessage,
	}),
	label: one({
		sourceField: ["labelId"],
		destField: ["id"],
		destSchema: mailLabel,
	}),
}));

const mailMessageMailboxRelationships = relationships(mailMessageMailbox, ({ one }) => ({
	message: one({
		sourceField: ["messageId"],
		destField: ["id"],
		destSchema: mailMessage,
	}),
	folder: one({
		sourceField: ["folderId"],
		destField: ["id"],
		destSchema: mailFolder,
	}),
}));

const mailAttachmentRelationships = relationships(mailAttachment, ({ one }) => ({
	message: one({
		sourceField: ["messageId"],
		destField: ["id"],
		destSchema: mailMessage,
	}),
}));

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const schema = createSchema({
	tables: [
		user,
		mailAccount,
		mailIdentity,
		mailFolder,
		mailLabel,
		mailConversation,
		mailConversationLabel,
		mailConversationFolder,
		mailMessage,
		mailMessageBodyPart,
		mailMessageHeader,
		mailMessageLabel,
		mailMessageMailbox,
		mailAttachment,
	],
	relationships: [
		userMailAccounts,
		mailAccountRelationships,
		mailIdentityRelationships,
		mailFolderRelationships,
		mailLabelRelationships,
		mailConversationRelationships,
		mailConversationLabelRelationships,
		mailConversationFolderRelationships,
		mailMessageRelationships,
		mailMessageBodyPartRelationships,
		mailMessageHeaderRelationships,
		mailMessageLabelRelationships,
		mailMessageMailboxRelationships,
		mailAttachmentRelationships,
	],
});

export const zql = createBuilder(schema);

export type Schema = typeof schema;

export type Context = { userId: string };

declare module "@rocicorp/zero" {
	interface DefaultTypes {
		schema: Schema;
		context: Context;
	}
}

export type UserRow = Row<typeof schema.tables.user>;
export type MailAccountRow = Row<typeof schema.tables.mail_account>;
export type MailIdentityRow = Row<typeof schema.tables.mail_identity>;
export type MailFolderRow = Row<typeof schema.tables.mail_folder>;
export type MailLabelRow = Row<typeof schema.tables.mail_label>;
export type MailConversationRow = Row<typeof schema.tables.mail_conversation>;
export type MailConversationLabelRow = Row<typeof schema.tables.mail_conversation_label>;
export type MailConversationFolderRow = Row<typeof schema.tables.mail_conversation_folder>;
export type MailMessageRow = Row<typeof schema.tables.mail_message>;
export type MailMessageBodyPartRow = Row<typeof schema.tables.mail_message_body_part>;
export type MailMessageHeaderRow = Row<typeof schema.tables.mail_message_header>;
export type MailMessageLabelRow = Row<typeof schema.tables.mail_message_label>;
export type MailMessageMailboxRow = Row<typeof schema.tables.mail_message_mailbox>;
export type MailAttachmentRow = Row<typeof schema.tables.mail_attachment>;

export type { Zero };
