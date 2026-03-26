import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";

import { zql } from "@chevrotain/zero/schema";
import type { Context, Schema } from "@chevrotain/zero/schema";

const defineQuery = defineQueryWithType<Schema, Context>();
const defineQueries = defineQueriesWithType<Schema>();

export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId ?? "").one()),

	// ---------------------------------------------------------------------------
	// Mail accounts
	// ---------------------------------------------------------------------------

	mailAccounts: defineQuery(({ ctx }) =>
		zql.mail_account
			.where("userId", ctx?.userId ?? "")
			.related("folders")
			.related("labels"),
	),

	// ---------------------------------------------------------------------------
	// Mail folders for an account
	// ---------------------------------------------------------------------------

	mailFolders: defineQuery(({ ctx, args }) =>
		zql.mail_folder
			.where("userId", ctx?.userId ?? "")
			.where("accountId", (args as { accountId: string }).accountId),
	),

	// ---------------------------------------------------------------------------
	// Mail labels for an account
	// ---------------------------------------------------------------------------

	mailLabels: defineQuery(({ ctx, args }) =>
		zql.mail_label
			.where("userId", ctx?.userId ?? "")
			.where("accountId", (args as { accountId: string }).accountId),
	),

	// ---------------------------------------------------------------------------
	// Conversations for an account (Gmail thread list)
	// ---------------------------------------------------------------------------

	mailConversations: defineQuery(({ ctx, args }) =>
		zql.mail_conversation
			.where("userId", ctx?.userId ?? "")
			.where("accountId", (args as { accountId: string }).accountId)
			.orderBy("latestMessageAt", "desc"),
	),

	// ---------------------------------------------------------------------------
	// Messages for an account (non-threaded message list)
	// ---------------------------------------------------------------------------

	mailMessages: defineQuery(({ ctx, args }) =>
		zql.mail_message
			.where("userId", ctx?.userId ?? "")
			.where("accountId", (args as { accountId: string }).accountId)
			.orderBy("receivedAt", "desc"),
	),

	// ---------------------------------------------------------------------------
	// Messages in a conversation (thread detail)
	// ---------------------------------------------------------------------------

	mailConversationMessages: defineQuery(({ ctx, args }) =>
		zql.mail_message
			.where("userId", ctx?.userId ?? "")
			.where("conversationId", (args as { conversationId: string }).conversationId)
			.related("attachments")
			.related("labels")
			.orderBy("receivedAt", "asc"),
	),

	// ---------------------------------------------------------------------------
	// Body parts for a message (detail view)
	// ---------------------------------------------------------------------------

	mailMessageBodyParts: defineQuery(({ ctx, args }) =>
		zql.mail_message_body_part
			.where("userId", ctx?.userId ?? "")
			.where("messageId", (args as { messageId: string }).messageId)
			.orderBy("partIndex", "asc"),
	),

	// ---------------------------------------------------------------------------
	// Messages in a folder via mailbox join table
	// ---------------------------------------------------------------------------

	mailFolderMessages: defineQuery(({ ctx, args }) =>
		zql.mail_message_mailbox
			.where("userId", ctx?.userId ?? "")
			.where("folderId", (args as { folderId: string }).folderId)
			.related("message"),
	),
});
