import { defineRelationsPart } from "drizzle-orm";

import { account, session, user } from "@chevrotain/core/auth/auth.sql";
import {
	mailAccount,
	mailAttachment,
	mailConversation,
	mailConversationFolder,
	mailConversationLabel,
	mailFolder,
	mailLabel,
	mailMessage,
	mailMessageBodyPart,
	mailMessageHeader,
	mailMessageLabel,
	mailMessageMailbox,
} from "@chevrotain/core/mail/mail.sql";

export const allRelations = defineRelationsPart(
	{
		user,
		session,
		account,
		mailAccount,
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
	},
	(r) => ({
		// Auth relations
		user: {
			sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
			accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
			mailAccounts: r.many.mailAccount({ from: r.user.id, to: r.mailAccount.userId }),
		},
		session: {
			user: r.one.user({ from: r.session.userId, to: r.user.id }),
		},
		account: {
			user: r.one.user({ from: r.account.userId, to: r.user.id }),
		},

		// Mail relations
		mailAccount: {
			user: r.one.user({ from: r.mailAccount.userId, to: r.user.id }),
			folders: r.many.mailFolder({
				from: r.mailAccount.id,
				to: r.mailFolder.accountId,
			}),
			labels: r.many.mailLabel({
				from: r.mailAccount.id,
				to: r.mailLabel.accountId,
			}),
			conversations: r.many.mailConversation({
				from: r.mailAccount.id,
				to: r.mailConversation.accountId,
			}),
			messages: r.many.mailMessage({
				from: r.mailAccount.id,
				to: r.mailMessage.accountId,
			}),
		},
		mailFolder: {
			account: r.one.mailAccount({
				from: r.mailFolder.accountId,
				to: r.mailAccount.id,
			}),
			mailboxEntries: r.many.mailMessageMailbox({
				from: r.mailFolder.id,
				to: r.mailMessageMailbox.folderId,
			}),
		},
		mailLabel: {
			account: r.one.mailAccount({
				from: r.mailLabel.accountId,
				to: r.mailAccount.id,
			}),
			messageLabels: r.many.mailMessageLabel({
				from: r.mailLabel.id,
				to: r.mailMessageLabel.labelId,
			}),
		},
		mailConversation: {
			account: r.one.mailAccount({
				from: r.mailConversation.accountId,
				to: r.mailAccount.id,
			}),
			messages: r.many.mailMessage({
				from: r.mailConversation.id,
				to: r.mailMessage.conversationId,
			}),
			labels: r.many.mailConversationLabel({
				from: r.mailConversation.id,
				to: r.mailConversationLabel.conversationId,
			}),
			folders: r.many.mailConversationFolder({
				from: r.mailConversation.id,
				to: r.mailConversationFolder.conversationId,
			}),
		},
		mailConversationLabel: {
			conversation: r.one.mailConversation({
				from: r.mailConversationLabel.conversationId,
				to: r.mailConversation.id,
			}),
			label: r.one.mailLabel({
				from: r.mailConversationLabel.labelId,
				to: r.mailLabel.id,
			}),
		},
		mailConversationFolder: {
			conversation: r.one.mailConversation({
				from: r.mailConversationFolder.conversationId,
				to: r.mailConversation.id,
			}),
			folder: r.one.mailFolder({
				from: r.mailConversationFolder.folderId,
				to: r.mailFolder.id,
			}),
		},
		mailMessage: {
			account: r.one.mailAccount({
				from: r.mailMessage.accountId,
				to: r.mailAccount.id,
			}),
			conversation: r.one.mailConversation({
				from: r.mailMessage.conversationId,
				to: r.mailConversation.id,
			}),
			bodyParts: r.many.mailMessageBodyPart({
				from: r.mailMessage.id,
				to: r.mailMessageBodyPart.messageId,
			}),
			header: r.one.mailMessageHeader({
				from: r.mailMessage.id,
				to: r.mailMessageHeader.messageId,
			}),
			labels: r.many.mailMessageLabel({
				from: r.mailMessage.id,
				to: r.mailMessageLabel.messageId,
			}),
			mailboxEntries: r.many.mailMessageMailbox({
				from: r.mailMessage.id,
				to: r.mailMessageMailbox.messageId,
			}),
			attachments: r.many.mailAttachment({
				from: r.mailMessage.id,
				to: r.mailAttachment.messageId,
			}),
		},
		mailMessageBodyPart: {
			message: r.one.mailMessage({
				from: r.mailMessageBodyPart.messageId,
				to: r.mailMessage.id,
			}),
		},
		mailMessageHeader: {
			message: r.one.mailMessage({
				from: r.mailMessageHeader.messageId,
				to: r.mailMessage.id,
			}),
		},
		mailMessageLabel: {
			message: r.one.mailMessage({
				from: r.mailMessageLabel.messageId,
				to: r.mailMessage.id,
			}),
			label: r.one.mailLabel({
				from: r.mailMessageLabel.labelId,
				to: r.mailLabel.id,
			}),
		},
		mailMessageMailbox: {
			message: r.one.mailMessage({
				from: r.mailMessageMailbox.messageId,
				to: r.mailMessage.id,
			}),
			folder: r.one.mailFolder({
				from: r.mailMessageMailbox.folderId,
				to: r.mailFolder.id,
			}),
		},
		mailAttachment: {
			message: r.one.mailMessage({
				from: r.mailAttachment.messageId,
				to: r.mailMessage.id,
			}),
		},
	}),
);
