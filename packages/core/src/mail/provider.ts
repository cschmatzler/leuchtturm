import { Schema } from "effect";

import { EmailAddress, MailFolderKind, MailLabelKind } from "@leuchtturm/core/mail/schema";

export const ProviderEmailAddress = EmailAddress;
export type ProviderEmailAddress = typeof ProviderEmailAddress.Type;

export const ProviderFolder = Schema.Struct({
	providerRef: Schema.String,
	kind: MailFolderKind,
	name: Schema.String,
	path: Schema.optional(Schema.String),
	delimiter: Schema.optional(Schema.String),
	isSelectable: Schema.Boolean,
});
export type ProviderFolder = typeof ProviderFolder.Type;

export const ProviderLabel = Schema.Struct({
	providerRef: Schema.String,
	name: Schema.String,
	path: Schema.optional(Schema.String),
	delimiter: Schema.optional(Schema.String),
	color: Schema.optional(Schema.String),
	kind: MailLabelKind,
});
export type ProviderLabel = typeof ProviderLabel.Type;

export const ProviderAttachment = Schema.Struct({
	providerRef: Schema.optional(Schema.String),
	filename: Schema.optional(Schema.String),
	mimeType: Schema.optional(Schema.String),
	size: Schema.optional(Schema.Number),
	isInline: Schema.Boolean,
	contentId: Schema.optional(Schema.String),
});
export type ProviderAttachment = typeof ProviderAttachment.Type;

export const ProviderBodyPart = Schema.Struct({
	contentType: Schema.Literals(["text/plain", "text/html"]),
	content: Schema.String,
});
export type ProviderBodyPart = typeof ProviderBodyPart.Type;

export const ProviderMessageHeaders = Schema.Struct({
	replyTo: Schema.optional(Schema.Array(ProviderEmailAddress)),
	inReplyTo: Schema.optional(Schema.String),
	references: Schema.optional(Schema.String),
	listUnsubscribe: Schema.optional(Schema.String),
	listUnsubscribePost: Schema.optional(Schema.String),
});
export type ProviderMessageHeaders = typeof ProviderMessageHeaders.Type;

export const ProviderMessage = Schema.Struct({
	providerRef: Schema.String,
	internetMessageId: Schema.optional(Schema.String),
	threadRef: Schema.optional(Schema.String),
	subject: Schema.optional(Schema.String),
	snippet: Schema.optional(Schema.String),
	sender: Schema.optional(ProviderEmailAddress),
	toRecipients: Schema.optional(Schema.Array(ProviderEmailAddress)),
	ccRecipients: Schema.optional(Schema.Array(ProviderEmailAddress)),
	bccRecipients: Schema.optional(Schema.Array(ProviderEmailAddress)),
	sentAt: Schema.optional(Schema.Date),
	receivedAt: Schema.optional(Schema.Date),
	isUnread: Schema.Boolean,
	isStarred: Schema.Boolean,
	isDraft: Schema.Boolean,
	labelRefs: Schema.optional(Schema.Array(Schema.String)),
	headers: Schema.optional(ProviderMessageHeaders),
	bodyParts: Schema.Array(ProviderBodyPart),
	attachments: Schema.Array(ProviderAttachment),
});
export type ProviderMessage = typeof ProviderMessage.Type;

export const ProviderThread = Schema.Struct({
	providerRef: Schema.String,
	messages: Schema.Array(ProviderMessage),
});
export type ProviderThread = typeof ProviderThread.Type;

export const ProviderHistoryChange = Schema.Struct({
	messagesAdded: Schema.Array(ProviderMessage),
	messagesDeleted: Schema.Array(Schema.String),
	labelsAdded: Schema.Array(
		Schema.Struct({
			messageRef: Schema.String,
			labelRefs: Schema.Array(Schema.String),
		}),
	),
	labelsRemoved: Schema.Array(
		Schema.Struct({
			messageRef: Schema.String,
			labelRefs: Schema.Array(Schema.String),
		}),
	),
});
export type ProviderHistoryChange = typeof ProviderHistoryChange.Type;

export interface MailProviderAdapter {
	listLabels(): Promise<ProviderLabel[]>;

	listRecentThreads(cutoff: Date): Promise<ProviderThread[]>;

	getHistoryChanges(cursor: string): Promise<{
		changes: ProviderHistoryChange;
		newCursor: string;
		cursorExpired: boolean;
	}>;

	getMessage(providerRef: string): Promise<ProviderMessage>;

	getLatestCursor(): Promise<string>;
}
