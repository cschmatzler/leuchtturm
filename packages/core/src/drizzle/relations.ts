import { defineRelationsPart } from "drizzle-orm";

import { account, session, user, verification } from "@leuchtturm/core/auth/auth.sql";
import {
	billingCustomer,
	billingOrder,
	billingSubscription,
} from "@leuchtturm/core/billing/billing.sql";
import {
	mailAccount,
	mailAccountSecret,
	mailAccountSyncState,
	mailAttachment,
	mailConversation,
	mailConversationFolder,
	mailConversationLabel,
	mailConversationRender,
	mailFolder,
	mailFolderSyncState,
	mailIdentity,
	mailLabel,
	mailMessage,
	mailMessageHeader,
	mailMessageLabel,
	mailMessageMailbox,
	mailMessageParticipant,
	mailMessageSource,
	mailOAuthState,
	mailParticipant,
	mailProviderState,
	mailSearchDocument,
} from "@leuchtturm/core/mail/mail.sql";

export const relations = defineRelationsPart(
	{
		user,
		session,
		account,
		verification,
		billingCustomer,
		billingSubscription,
		billingOrder,
		mailAccount,
		mailAccountSecret,
		mailOAuthState,
		mailIdentity,
		mailFolder,
		mailFolderSyncState,
		mailLabel,
		mailConversation,
		mailConversationLabel,
		mailConversationFolder,
		mailConversationRender,
		mailMessage,
		mailMessageHeader,
		mailMessageLabel,
		mailMessageMailbox,
		mailAttachment,
		mailAccountSyncState,
		mailParticipant,
		mailMessageParticipant,
		mailSearchDocument,
		mailMessageSource,
		mailProviderState,
	},
	(r) => ({
		user: {
			sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
			accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
			billingCustomer: r.one.billingCustomer({
				from: r.user.id,
				to: r.billingCustomer.userId,
			}),
			billingSubscriptions: r.many.billingSubscription({
				from: r.user.id,
				to: r.billingSubscription.userId,
			}),
			billingOrders: r.many.billingOrder({ from: r.user.id, to: r.billingOrder.userId }),
			mailAccounts: r.many.mailAccount({ from: r.user.id, to: r.mailAccount.userId }),
			mailOAuthStates: r.many.mailOAuthState({
				from: r.user.id,
				to: r.mailOAuthState.userId,
			}),
			mailIdentities: r.many.mailIdentity({ from: r.user.id, to: r.mailIdentity.userId }),
			mailParticipants: r.many.mailParticipant({
				from: r.user.id,
				to: r.mailParticipant.userId,
			}),
		},
		session: {
			user: r.one.user({ from: r.session.userId, to: r.user.id }),
			mailOAuthStates: r.many.mailOAuthState({
				from: r.session.id,
				to: r.mailOAuthState.sessionId,
			}),
		},
		account: {
			user: r.one.user({ from: r.account.userId, to: r.user.id }),
		},
		billingCustomer: {
			user: r.one.user({ from: r.billingCustomer.userId, to: r.user.id }),
			subscriptions: r.many.billingSubscription({
				from: [r.billingCustomer.userId, r.billingCustomer.polarCustomerId],
				to: [r.billingSubscription.userId, r.billingSubscription.polarCustomerId],
			}),
			orders: r.many.billingOrder({
				from: [r.billingCustomer.userId, r.billingCustomer.polarCustomerId],
				to: [r.billingOrder.userId, r.billingOrder.polarCustomerId],
			}),
		},
		billingSubscription: {
			user: r.one.user({ from: r.billingSubscription.userId, to: r.user.id }),
			customer: r.one.billingCustomer({
				from: [r.billingSubscription.userId, r.billingSubscription.polarCustomerId],
				to: [r.billingCustomer.userId, r.billingCustomer.polarCustomerId],
			}),
			orders: r.many.billingOrder({
				from: [r.billingSubscription.id, r.billingSubscription.userId],
				to: [r.billingOrder.subscriptionId, r.billingOrder.userId],
			}),
		},
		billingOrder: {
			user: r.one.user({ from: r.billingOrder.userId, to: r.user.id }),
			customer: r.one.billingCustomer({
				from: [r.billingOrder.userId, r.billingOrder.polarCustomerId],
				to: [r.billingCustomer.userId, r.billingCustomer.polarCustomerId],
			}),
			subscription: r.one.billingSubscription({
				from: [r.billingOrder.subscriptionId, r.billingOrder.userId],
				to: [r.billingSubscription.id, r.billingSubscription.userId],
			}),
		},
		mailAccount: {
			user: r.one.user({ from: r.mailAccount.userId, to: r.user.id }),
			secret: r.one.mailAccountSecret({
				from: r.mailAccount.id,
				to: r.mailAccountSecret.accountId,
			}),
			syncStates: r.many.mailAccountSyncState({
				from: r.mailAccount.id,
				to: r.mailAccountSyncState.accountId,
			}),
			identities: r.many.mailIdentity({
				from: r.mailAccount.id,
				to: r.mailIdentity.accountId,
			}),
			folders: r.many.mailFolder({ from: r.mailAccount.id, to: r.mailFolder.accountId }),
			labels: r.many.mailLabel({ from: r.mailAccount.id, to: r.mailLabel.accountId }),
			conversations: r.many.mailConversation({
				from: r.mailAccount.id,
				to: r.mailConversation.accountId,
			}),
			conversationRenders: r.many.mailConversationRender({
				from: r.mailAccount.id,
				to: r.mailConversationRender.accountId,
			}),
			messages: r.many.mailMessage({ from: r.mailAccount.id, to: r.mailMessage.accountId }),
			searchDocuments: r.many.mailSearchDocument({
				from: r.mailAccount.id,
				to: r.mailSearchDocument.accountId,
			}),
			providerStates: r.many.mailProviderState({
				from: r.mailAccount.id,
				to: r.mailProviderState.accountId,
			}),
		},
		mailAccountSecret: {
			account: r.one.mailAccount({
				from: r.mailAccountSecret.accountId,
				to: r.mailAccount.id,
			}),
		},
		mailAccountSyncState: {
			account: r.one.mailAccount({
				from: r.mailAccountSyncState.accountId,
				to: r.mailAccount.id,
			}),
		},
		mailOAuthState: {
			user: r.one.user({ from: r.mailOAuthState.userId, to: r.user.id }),
			session: r.one.session({ from: r.mailOAuthState.sessionId, to: r.session.id }),
		},
		mailIdentity: {
			user: r.one.user({ from: r.mailIdentity.userId, to: r.user.id }),
			account: r.one.mailAccount({
				from: r.mailIdentity.accountId,
				to: r.mailAccount.id,
			}),
		},
		mailFolder: {
			account: r.one.mailAccount({ from: r.mailFolder.accountId, to: r.mailAccount.id }),
			syncStates: r.many.mailFolderSyncState({
				from: r.mailFolder.id,
				to: r.mailFolderSyncState.folderId,
			}),
			mailboxEntries: r.many.mailMessageMailbox({
				from: r.mailFolder.id,
				to: r.mailMessageMailbox.folderId,
			}),
			conversationFolders: r.many.mailConversationFolder({
				from: r.mailFolder.id,
				to: r.mailConversationFolder.folderId,
			}),
		},
		mailFolderSyncState: {
			account: r.one.mailAccount({
				from: r.mailFolderSyncState.accountId,
				to: r.mailAccount.id,
			}),
			folder: r.one.mailFolder({ from: r.mailFolderSyncState.folderId, to: r.mailFolder.id }),
		},
		mailLabel: {
			account: r.one.mailAccount({ from: r.mailLabel.accountId, to: r.mailAccount.id }),
			messageLabels: r.many.mailMessageLabel({
				from: r.mailLabel.id,
				to: r.mailMessageLabel.labelId,
			}),
			conversationLabels: r.many.mailConversationLabel({
				from: r.mailLabel.id,
				to: r.mailConversationLabel.labelId,
			}),
		},
		mailConversation: {
			account: r.one.mailAccount({
				from: r.mailConversation.accountId,
				to: r.mailAccount.id,
			}),
			render: r.one.mailConversationRender({
				from: [r.mailConversation.id, r.mailConversation.accountId, r.mailConversation.userId],
				to: [
					r.mailConversationRender.conversationId,
					r.mailConversationRender.accountId,
					r.mailConversationRender.userId,
				],
			}),
			latestMessage: r.one.mailMessage({
				from: [
					r.mailConversation.latestMessageId,
					r.mailConversation.accountId,
					r.mailConversation.userId,
				],
				to: [r.mailMessage.id, r.mailMessage.accountId, r.mailMessage.userId],
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
			searchDocuments: r.many.mailSearchDocument({
				from: r.mailConversation.id,
				to: r.mailSearchDocument.conversationId,
			}),
		},
		mailConversationLabel: {
			conversation: r.one.mailConversation({
				from: r.mailConversationLabel.conversationId,
				to: r.mailConversation.id,
			}),
			label: r.one.mailLabel({ from: r.mailConversationLabel.labelId, to: r.mailLabel.id }),
		},
		mailConversationFolder: {
			conversation: r.one.mailConversation({
				from: r.mailConversationFolder.conversationId,
				to: r.mailConversation.id,
			}),
			folder: r.one.mailFolder({ from: r.mailConversationFolder.folderId, to: r.mailFolder.id }),
		},
		mailConversationRender: {
			conversation: r.one.mailConversation({
				from: [
					r.mailConversationRender.conversationId,
					r.mailConversationRender.accountId,
					r.mailConversationRender.userId,
				],
				to: [r.mailConversation.id, r.mailConversation.accountId, r.mailConversation.userId],
			}),
			account: r.one.mailAccount({
				from: r.mailConversationRender.accountId,
				to: r.mailAccount.id,
			}),
		},
		mailMessage: {
			account: r.one.mailAccount({ from: r.mailMessage.accountId, to: r.mailAccount.id }),
			conversation: r.one.mailConversation({
				from: r.mailMessage.conversationId,
				to: r.mailConversation.id,
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
			participants: r.many.mailMessageParticipant({
				from: r.mailMessage.id,
				to: r.mailMessageParticipant.messageId,
			}),
			searchDocument: r.one.mailSearchDocument({
				from: r.mailMessage.id,
				to: r.mailSearchDocument.messageId,
			}),
			sources: r.many.mailMessageSource({
				from: r.mailMessage.id,
				to: r.mailMessageSource.messageId,
			}),
		},
		mailMessageHeader: {
			message: r.one.mailMessage({ from: r.mailMessageHeader.messageId, to: r.mailMessage.id }),
		},
		mailMessageLabel: {
			message: r.one.mailMessage({ from: r.mailMessageLabel.messageId, to: r.mailMessage.id }),
			label: r.one.mailLabel({ from: r.mailMessageLabel.labelId, to: r.mailLabel.id }),
		},
		mailMessageMailbox: {
			message: r.one.mailMessage({ from: r.mailMessageMailbox.messageId, to: r.mailMessage.id }),
			folder: r.one.mailFolder({ from: r.mailMessageMailbox.folderId, to: r.mailFolder.id }),
		},
		mailAttachment: {
			message: r.one.mailMessage({ from: r.mailAttachment.messageId, to: r.mailMessage.id }),
		},
		mailParticipant: {
			user: r.one.user({ from: r.mailParticipant.userId, to: r.user.id }),
			messageParticipants: r.many.mailMessageParticipant({
				from: r.mailParticipant.id,
				to: r.mailMessageParticipant.participantId,
			}),
		},
		mailMessageParticipant: {
			message: r.one.mailMessage({
				from: r.mailMessageParticipant.messageId,
				to: r.mailMessage.id,
			}),
			participant: r.one.mailParticipant({
				from: r.mailMessageParticipant.participantId,
				to: r.mailParticipant.id,
			}),
		},
		mailSearchDocument: {
			message: r.one.mailMessage({
				from: r.mailSearchDocument.messageId,
				to: r.mailMessage.id,
			}),
			user: r.one.user({ from: r.mailSearchDocument.userId, to: r.user.id }),
			account: r.one.mailAccount({
				from: r.mailSearchDocument.accountId,
				to: r.mailAccount.id,
			}),
			conversation: r.one.mailConversation({
				from: r.mailSearchDocument.conversationId,
				to: r.mailConversation.id,
			}),
		},
		mailMessageSource: {
			message: r.one.mailMessage({
				from: r.mailMessageSource.messageId,
				to: r.mailMessage.id,
			}),
		},
		mailProviderState: {
			account: r.one.mailAccount({
				from: r.mailProviderState.accountId,
				to: r.mailAccount.id,
			}),
		},
	}),
);
