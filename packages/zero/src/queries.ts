import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";

import { zql } from "@chevrotain/zero/schema";
import type { Context, Schema } from "@chevrotain/zero/schema";

const defineQuery = defineQueryWithType<Schema, Context>();
const defineQueries = defineQueriesWithType<Schema>();

export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId ?? "").one()),

	mailAccounts: defineQuery(({ ctx }) =>
		zql.mail_account
			.where("userId", ctx?.userId ?? "")
			.related("identities")
			.related("folders")
			.related("labels"),
	),

	mailFolders: defineQuery(({ ctx, args }) =>
		zql.mail_folder
			.where("userId", ctx?.userId ?? "")
			.where("accountId", (args as { accountId: string }).accountId),
	),

	mailFolder: defineQuery(({ ctx, args }) =>
		zql.mail_folder
			.where("userId", ctx?.userId ?? "")
			.where("id", (args as { folderId: string }).folderId)
			.one(),
	),

	mailLabels: defineQuery(({ ctx, args }) =>
		zql.mail_label
			.where("userId", ctx?.userId ?? "")
			.where("accountId", (args as { accountId: string }).accountId),
	),

	mailConversations: defineQuery(({ ctx, args }) =>
		zql.mail_conversation
			.where("userId", ctx?.userId ?? "")
			.where("accountId", (args as { accountId: string }).accountId)
			.related("labels")
			.related("folders")
			.orderBy("latestMessageAt", "desc"),
	),

	mailConversation: defineQuery(({ ctx, args }) =>
		zql.mail_conversation
			.where("userId", ctx?.userId ?? "")
			.where("id", (args as { conversationId: string }).conversationId)
			.related("labels")
			.related("folders")
			.one(),
	),

	mailMessages: defineQuery(({ ctx, args }) =>
		zql.mail_message
			.where("userId", ctx?.userId ?? "")
			.where("accountId", (args as { accountId: string }).accountId)
			.orderBy("receivedAt", "desc"),
	),

	mailMessage: defineQuery(({ ctx, args }) =>
		zql.mail_message
			.where("userId", ctx?.userId ?? "")
			.where("id", (args as { messageId: string }).messageId)
			.one(),
	),

	mailConversationMessages: defineQuery(({ ctx, args }) =>
		zql.mail_message
			.where("userId", ctx?.userId ?? "")
			.where("conversationId", (args as { conversationId: string }).conversationId)
			.related("attachments")
			.related("labels")
			.related("header")
			.orderBy("receivedAt", "asc"),
	),

	mailMessageBodyParts: defineQuery(({ ctx, args }) =>
		zql.mail_message_body_part
			.where("userId", ctx?.userId ?? "")
			.where("messageId", (args as { messageId: string }).messageId)
			.orderBy("partIndex", "asc"),
	),

	mailFolderMessages: defineQuery(({ ctx, args }) =>
		zql.mail_message_mailbox
			.where("userId", ctx?.userId ?? "")
			.where("folderId", (args as { folderId: string }).folderId)
			.related("message"),
	),
});
