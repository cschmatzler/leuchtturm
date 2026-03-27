/**
 * Gmail sync service (§13).
 *
 * Handles:
 * - Bootstrap sync (30-day import with full qualifying threads)
 * - Incremental sync via Gmail history API
 * - Bounded resync on cursor expiration
 *
 * Sync concurrency is handled at the workflow layer via idempotency keys.
 */

import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Effect } from "effect";

import { Database } from "@chevrotain/core/drizzle/index";
import type { allRelations } from "@chevrotain/core/drizzle/relations";
import { getGmailFolders, GmailAdapter } from "@chevrotain/core/mail/gmail/adapter";
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
	mailMessageLabel,
	mailMessageMailbox,
	mailAccountSyncState,
} from "@chevrotain/core/mail/mail.sql";
import type {
	ProviderLabel,
	ProviderMessage,
	ProviderThread,
} from "@chevrotain/core/mail/provider";
import {
	createMailAttachmentId,
	createMailConversationId,
	createMailFolderId,
	createMailLabelId,
	createMailMessageBodyPartId,
	createMailMessageId,
	createMailMessageMailboxId,
	createMailAccountSyncStateId,
} from "@chevrotain/core/mail/schema";

type SyncDatabaseClient = NodePgDatabase<Record<string, never>, typeof allRelations>;

// ---------------------------------------------------------------------------
// Sync entry point
// ---------------------------------------------------------------------------

/**
 * Run a sync for a Gmail account. Falls back to a full bootstrap when
 * no history cursor exists yet.
 */
export function incrementalGmailSync(accountId: string, accessToken: string) {
	return Effect.gen(function* () {
		const { db } = yield* Database.Service;
		yield* incrementalGmailSyncImpl(db, accountId, accessToken);
	});
}

function bootstrapGmailAccountImpl(db: SyncDatabaseClient, accountId: string, accessToken: string) {
	return Effect.gen(function* () {
		const [account] = yield* Effect.tryPromise(() =>
			db.select().from(mailAccount).where(eq(mailAccount.id, accountId)).limit(1),
		);
		if (!account) return yield* Effect.fail(new Error(`Account ${accountId} not found`));

		try {
			yield* Effect.tryPromise(() =>
				db
					.update(mailAccount)
					.set({ status: "bootstrapping" })
					.where(eq(mailAccount.id, accountId)),
			);

			const adapter = new GmailAdapter(accessToken);
			const labels = yield* Effect.tryPromise(() => adapter.listLabels());
			yield* syncLabels(db, account.userId, accountId, labels);

			const folders = getGmailFolders(labels);
			yield* syncFolders(db, account.userId, accountId, folders);

			const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const threads = yield* Effect.tryPromise(() => adapter.listRecentThreads(cutoff));
			yield* syncThreads(db, account.userId, accountId, threads);

			const cursor = yield* Effect.tryPromise(() => adapter.getLatestCursor());
			yield* upsertSyncCursor(db, accountId, cursor);

			yield* Effect.tryPromise(() =>
				db.update(mailAccount).set({ status: "healthy" }).where(eq(mailAccount.id, accountId)),
			);
		} catch (error) {
			yield* Effect.tryPromise(() =>
				db.update(mailAccount).set({ status: "degraded" }).where(eq(mailAccount.id, accountId)),
			);
			throw error;
		}
	});
}

function incrementalGmailSyncImpl(db: SyncDatabaseClient, accountId: string, accessToken: string) {
	return Effect.gen(function* () {
		const [account] = yield* Effect.tryPromise(() =>
			db.select().from(mailAccount).where(eq(mailAccount.id, accountId)).limit(1),
		);
		if (!account) return yield* Effect.fail(new Error(`Account ${accountId} not found`));

		const adapter = new GmailAdapter(accessToken);
		const [cursorRow] = yield* Effect.tryPromise(() =>
			db
				.select()
				.from(mailAccountSyncState)
				.where(
					and(
						eq(mailAccountSyncState.accountId, accountId),
						eq(mailAccountSyncState.stateKind, "gmail_history"),
					),
				)
				.limit(1),
		);

		if (!cursorRow) {
			yield* bootstrapGmailAccountImpl(db, accountId, accessToken);
			return;
		}

		const startHistoryId = (cursorRow.payload as { historyId: string }).historyId;
		const { changes, newCursor, cursorExpired } = yield* Effect.tryPromise(() =>
			adapter.getHistoryChanges(startHistoryId),
		);

		if (cursorExpired) {
			yield* Effect.tryPromise(() =>
				db.update(mailAccount).set({ status: "resyncing" }).where(eq(mailAccount.id, accountId)),
			);
			yield* boundedResync(db, account.userId, accountId, adapter);
			return;
		}

		for (const message of changes.messagesAdded) {
			yield* upsertMessage(db, account.userId, accountId, message);
		}

		for (const deletedRef of changes.messagesDeleted) {
			yield* deleteMessageByProviderRef(db, accountId, deletedRef);
		}

		for (const { messageRef, labelRefs } of changes.labelsAdded) {
			yield* addMessageLabels(db, account.userId, accountId, messageRef, labelRefs);
		}

		for (const { messageRef, labelRefs } of changes.labelsRemoved) {
			yield* removeMessageLabels(db, accountId, messageRef, labelRefs);
		}

		yield* upsertSyncCursor(db, accountId, newCursor);

		const labels = yield* Effect.tryPromise(() => adapter.listLabels());
		yield* syncLabels(db, account.userId, accountId, labels);
	});
}

// ---------------------------------------------------------------------------
// Bounded resync (§25.3)
// ---------------------------------------------------------------------------

async function boundedResyncImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	adapter: GmailAdapter,
): Promise<void> {
	const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	const threads = await adapter.listRecentThreads(cutoff);

	// Upsert — repair recent authoritative slice without deleting older mirrored mail
	for (const thread of threads) {
		await syncThreadImpl(db, userId, accountId, thread);
	}

	const cursor = await adapter.getLatestCursor();
	await upsertSyncCursorImpl(db, accountId, cursor);

	await db.update(mailAccount).set({ status: "healthy" }).where(eq(mailAccount.id, accountId));
}

function boundedResync(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	adapter: GmailAdapter,
) {
	return Effect.tryPromise(() => boundedResyncImpl(db, userId, accountId, adapter));
}

// ---------------------------------------------------------------------------
// Data writing helpers
// ---------------------------------------------------------------------------

function syncLabels(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	labels: ProviderLabel[],
) {
	return Effect.tryPromise(async () => {
		const now = new Date();
		for (const label of labels) {
			await db
				.insert(mailLabel)
				.values({
					id: createMailLabelId(),
					userId,
					accountId,
					providerLabelRef: label.providerRef,
					name: label.name,
					color: label.color,
					kind: label.kind,
					createdAt: now,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [mailLabel.accountId, mailLabel.providerLabelRef],
					targetWhere: and(
						eq(mailLabel.accountId, accountId),
						eq(mailLabel.providerLabelRef, label.providerRef),
					),
					set: { name: label.name, color: label.color, kind: label.kind, updatedAt: now },
				});
		}
	});
}

function syncFolders(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	folders: Array<{ providerRef: string; kind: string; name: string }>,
) {
	return Effect.tryPromise(async () => {
		const now = new Date();
		for (const folder of folders) {
			await db
				.insert(mailFolder)
				.values({
					id: createMailFolderId(),
					userId,
					accountId,
					providerFolderRef: folder.providerRef,
					kind: folder.kind,
					name: folder.name,
					isSelectable: true,
					createdAt: now,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [mailFolder.accountId, mailFolder.providerFolderRef],
					targetWhere: and(
						eq(mailFolder.accountId, accountId),
						eq(mailFolder.providerFolderRef, folder.providerRef),
					),
					set: { name: folder.name, kind: folder.kind, updatedAt: now },
				});
		}
	});
}

function syncThreads(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	threads: ProviderThread[],
) {
	return Effect.tryPromise(async () => {
		for (const thread of threads) {
			await syncThreadImpl(db, userId, accountId, thread);
		}
	});
}

function collectParticipants(
	messages: ProviderMessage[],
): Array<{ name?: string; address: string }> {
	const seen = new Set<string>();
	const participants: Array<{ name?: string; address: string }> = [];
	for (const msg of messages) {
		if (msg.sender) {
			const key = msg.sender.address.toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				participants.push(msg.sender);
			}
		}
	}
	return participants;
}

async function syncThreadImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	thread: ProviderThread,
): Promise<void> {
	const now = new Date();
	const messages = thread.messages;
	if (messages.length === 0) return;

	// Upsert conversation with projection fields
	const latestMessage = messages[messages.length - 1]!;
	const conversationId = createMailConversationId();
	const subject = messages[0]?.subject ?? null;
	const participantsPreview = collectParticipants(messages);

	const conversationValues = {
		subject,
		snippet: latestMessage.snippet ?? null,
		latestMessageAt: latestMessage.receivedAt ?? now,
		latestSender: latestMessage.sender ?? null,
		participantsPreview,
		messageCount: messages.length,
		unreadCount: messages.filter((m) => m.isUnread).length,
		hasAttachments: messages.some((m) => m.attachments.length > 0),
		isStarred: messages.some((m) => m.isStarred),
		draftCount: messages.filter((m) => m.isDraft).length,
		updatedAt: now,
	};

	const [conversation] = await db
		.insert(mailConversation)
		.values({
			id: conversationId,
			userId,
			accountId,
			providerConversationRef: thread.providerRef,
			...conversationValues,
			createdAt: now,
		})
		.onConflictDoUpdate({
			target: [mailConversation.accountId, mailConversation.providerConversationRef],
			targetWhere: and(
				eq(mailConversation.accountId, accountId),
				eq(mailConversation.providerConversationRef, thread.providerRef),
			),
			set: conversationValues,
		})
		.returning({ id: mailConversation.id });

	const convId = conversation?.id ?? conversationId;

	// Upsert each message in the thread
	for (const message of messages) {
		await upsertMessageImpl(db, userId, accountId, message, convId);
	}

	// Recompute derived conversation projections after all messages are synced
	await recomputeConversationProjections(db, userId, accountId, convId);
}

function upsertMessage(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	message: ProviderMessage,
) {
	return Effect.tryPromise(() => upsertMessageImpl(db, userId, accountId, message));
}

async function ensureConversationForMessage(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	message: ProviderMessage,
): Promise<string | undefined> {
	if (!message.threadRef) {
		return undefined;
	}

	const now = new Date();
	const conversationId = createMailConversationId();
	const [conversation] = await db
		.insert(mailConversation)
		.values({
			id: conversationId,
			userId,
			accountId,
			providerConversationRef: message.threadRef,
			subject: message.subject ?? null,
			snippet: message.snippet ?? null,
			latestMessageAt: message.receivedAt ?? now,
			messageCount: 0,
			unreadCount: 0,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [mailConversation.accountId, mailConversation.providerConversationRef],
			targetWhere: and(
				eq(mailConversation.accountId, accountId),
				eq(mailConversation.providerConversationRef, message.threadRef),
			),
			set: {
				subject: message.subject ?? null,
				snippet: message.snippet ?? null,
				latestMessageAt: message.receivedAt ?? now,
				updatedAt: now,
			},
		})
		.returning({ id: mailConversation.id });

	return conversation?.id ?? conversationId;
}

async function recomputeConversationStats(
	db: SyncDatabaseClient,
	conversationId: string,
): Promise<void> {
	const messages = await db
		.select({
			id: mailMessage.id,
			isUnread: mailMessage.isUnread,
			isStarred: mailMessage.isStarred,
			isDraft: mailMessage.isDraft,
			hasAttachments: mailMessage.hasAttachments,
			subject: mailMessage.subject,
			snippet: mailMessage.snippet,
			sender: mailMessage.sender,
			receivedAt: mailMessage.receivedAt,
			createdAt: mailMessage.createdAt,
			userId: mailMessage.userId,
			accountId: mailMessage.accountId,
		})
		.from(mailMessage)
		.where(eq(mailMessage.conversationId, conversationId))
		.orderBy(desc(mailMessage.receivedAt), desc(mailMessage.createdAt));

	if (messages.length === 0) {
		await db.delete(mailConversation).where(eq(mailConversation.id, conversationId));
		return;
	}

	const latestMessage = messages[0]!;

	// Collect unique participants
	const seen = new Set<string>();
	const participantsPreview: Array<{ name?: string; address: string }> = [];
	for (const msg of messages) {
		const sender = msg.sender as { name?: string; address: string } | null;
		if (sender) {
			const key = sender.address.toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				participantsPreview.push(sender);
			}
		}
	}

	await db
		.update(mailConversation)
		.set({
			subject: latestMessage.subject ?? null,
			snippet: latestMessage.snippet ?? null,
			latestMessageAt: latestMessage.receivedAt ?? latestMessage.createdAt,
			latestMessageId: latestMessage.id,
			latestSender: latestMessage.sender,
			participantsPreview,
			messageCount: messages.length,
			unreadCount: messages.filter((m) => m.isUnread).length,
			hasAttachments: messages.some((m) => m.hasAttachments),
			isStarred: messages.some((m) => m.isStarred),
			draftCount: messages.filter((m) => m.isDraft).length,
			updatedAt: new Date(),
		})
		.where(eq(mailConversation.id, conversationId));

	// Also recompute derived conversation label/folder projections
	if (latestMessage.userId && latestMessage.accountId) {
		await recomputeConversationProjections(
			db,
			latestMessage.userId,
			latestMessage.accountId,
			conversationId,
		);
	}
}

async function recomputeConversationProjections(
	db: SyncDatabaseClient,
	userId: string,
	_accountId: string,
	conversationId: string,
): Promise<void> {
	const now = new Date();

	// Get all message IDs in this conversation
	const messageIds = await db
		.select({ id: mailMessage.id })
		.from(mailMessage)
		.where(eq(mailMessage.conversationId, conversationId));

	if (messageIds.length === 0) return;

	const msgIds = messageIds.map((m) => m.id);

	// Derive conversation-level labels from message labels
	const labelIdSet = new Set<string>();
	for (const id of msgIds) {
		const rows = await db
			.select({ labelId: mailMessageLabel.labelId })
			.from(mailMessageLabel)
			.where(eq(mailMessageLabel.messageId, id));
		for (const row of rows) {
			labelIdSet.add(row.labelId);
		}
	}

	// Replace conversation labels
	await db
		.delete(mailConversationLabel)
		.where(eq(mailConversationLabel.conversationId, conversationId));
	for (const labelId of labelIdSet) {
		await db
			.insert(mailConversationLabel)
			.values({ userId, conversationId, labelId, createdAt: now, updatedAt: now })
			.onConflictDoNothing();
	}

	// Derive conversation-level folders from message mailboxes
	const folderIdSet = new Set<string>();
	for (const id of msgIds) {
		const rows = await db
			.select({ folderId: mailMessageMailbox.folderId })
			.from(mailMessageMailbox)
			.where(eq(mailMessageMailbox.messageId, id));
		for (const row of rows) {
			folderIdSet.add(row.folderId);
		}
	}

	// Replace conversation folders
	await db
		.delete(mailConversationFolder)
		.where(eq(mailConversationFolder.conversationId, conversationId));
	for (const folderId of folderIdSet) {
		await db
			.insert(mailConversationFolder)
			.values({ userId, conversationId, folderId, createdAt: now, updatedAt: now })
			.onConflictDoNothing();
	}
}

async function getCurrentMessageLabelRefs(
	db: SyncDatabaseClient,
	messageId: string,
): Promise<string[]> {
	const rows = await db
		.select({ providerLabelRef: mailLabel.providerLabelRef })
		.from(mailMessageLabel)
		.innerJoin(mailLabel, eq(mailMessageLabel.labelId, mailLabel.id))
		.where(eq(mailMessageLabel.messageId, messageId));

	return rows.map((row) => row.providerLabelRef);
}

async function upsertMessageImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	message: ProviderMessage,
	conversationId?: string,
): Promise<void> {
	const now = new Date();
	const messageId = createMailMessageId();
	const resolvedConversationId =
		conversationId ?? (await ensureConversationForMessage(db, userId, accountId, message));

	const bodyParts = message.bodyParts;
	const hasHtml = bodyParts.some((p) => p.contentType === "text/html");
	const hasPlainText = bodyParts.some((p) => p.contentType === "text/plain");

	// If message already exists, get its ID
	const [existing] = await db
		.select({ id: mailMessage.id, conversationId: mailMessage.conversationId })
		.from(mailMessage)
		.where(
			and(
				eq(mailMessage.accountId, accountId),
				eq(mailMessage.providerMessageRef, message.providerRef),
			),
		)
		.limit(1);

	const msgId = existing?.id ?? messageId;

	if (existing) {
		// Update existing message
		await db
			.update(mailMessage)
			.set({
				conversationId: resolvedConversationId ?? existing.conversationId ?? null,
				isUnread: message.isUnread,
				isStarred: message.isStarred,
				isDraft: message.isDraft,
				subject: message.subject ?? null,
				snippet: message.snippet ?? null,
				sentAt: message.sentAt ?? null,
				receivedAt: message.receivedAt ?? null,
				hasAttachments: message.attachments.length > 0,
				hasHtml,
				hasPlainText,
				updatedAt: now,
			})
			.where(eq(mailMessage.id, existing.id));
	} else {
		// Insert new message
		await db.insert(mailMessage).values({
			id: msgId,
			userId,
			accountId,
			conversationId: resolvedConversationId ?? null,
			providerMessageRef: message.providerRef,
			internetMessageId: message.internetMessageId ?? null,
			subject: message.subject ?? null,
			snippet: message.snippet ?? null,
			sender: message.sender ?? null,
			toRecipients: message.toRecipients ?? null,
			ccRecipients: message.ccRecipients ?? null,
			bccRecipients: message.bccRecipients ?? null,
			sentAt: message.sentAt ?? null,
			receivedAt: message.receivedAt ?? null,
			isUnread: message.isUnread,
			isStarred: message.isStarred,
			isDraft: message.isDraft,
			hasAttachments: message.attachments.length > 0,
			hasHtml,
			hasPlainText,
			createdAt: now,
			updatedAt: now,
		});

		// Insert body parts (§11.7)
		let preferredSet = false;
		for (let i = 0; i < bodyParts.length; i++) {
			const part = bodyParts[i]!;
			const isPreferred =
				!preferredSet && (part.contentType === "text/html" || (i === 0 && !hasHtml));

			await db.insert(mailMessageBodyPart).values({
				id: createMailMessageBodyPartId(),
				userId,
				messageId: msgId,
				partIndex: i,
				contentType: part.contentType,
				content: part.content,
				isPreferredRender: isPreferred,
				createdAt: now,
				updatedAt: now,
			});

			if (isPreferred) preferredSet = true;
		}

		// Insert attachments (§11.10)
		for (const attachment of message.attachments) {
			await db.insert(mailAttachment).values({
				id: createMailAttachmentId(),
				userId,
				messageId: msgId,
				providerAttachmentRef: attachment.providerRef ?? null,
				filename: attachment.filename ?? null,
				mimeType: attachment.mimeType ?? null,
				size: attachment.size ?? null,
				isInline: attachment.isInline,
				contentId: attachment.contentId ?? null,
				createdAt: now,
				updatedAt: now,
			});
		}
	}

	// Sync label associations
	if (message.labelRefs) {
		await syncMessageLabelsImpl(db, userId, accountId, msgId, message.labelRefs);
	}

	// Sync folder membership (derived from system labels)
	if (message.labelRefs) {
		await syncMessageFolderMembershipImpl(db, userId, accountId, msgId, message.labelRefs);
	}

	if (resolvedConversationId) {
		await recomputeConversationStats(db, resolvedConversationId);
	}
}

async function syncMessageLabelsImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	messageId: string,
	labelRefs: string[],
): Promise<void> {
	const now = new Date();

	// Get label IDs for these refs
	const dbLabels = await db
		.select({ id: mailLabel.id, providerLabelRef: mailLabel.providerLabelRef })
		.from(mailLabel)
		.where(eq(mailLabel.accountId, accountId));

	const refToId = new Map(dbLabels.map((l) => [l.providerLabelRef, l.id]));

	// Delete existing label associations for this message
	await db.delete(mailMessageLabel).where(eq(mailMessageLabel.messageId, messageId));

	// Insert new associations
	for (const ref of labelRefs) {
		const labelId = refToId.get(ref);
		if (labelId) {
			await db
				.insert(mailMessageLabel)
				.values({ userId, messageId, labelId, createdAt: now, updatedAt: now })
				.onConflictDoNothing();
		}
	}
}

async function syncMessageFolderMembershipImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	messageId: string,
	labelRefs: string[],
): Promise<void> {
	const now = new Date();

	// Get folders for this account
	const dbFolders = await db
		.select({ id: mailFolder.id, providerFolderRef: mailFolder.providerFolderRef })
		.from(mailFolder)
		.where(eq(mailFolder.accountId, accountId));

	const refToFolderId = new Map(dbFolders.map((f) => [f.providerFolderRef, f.id]));

	// Delete existing mailbox entries for this message
	await db.delete(mailMessageMailbox).where(eq(mailMessageMailbox.messageId, messageId));

	// Insert folder memberships based on system label refs
	for (const ref of labelRefs) {
		const folderId = refToFolderId.get(ref);
		if (folderId) {
			await db
				.insert(mailMessageMailbox)
				.values({
					id: createMailMessageMailboxId(),
					userId,
					messageId,
					accountId,
					folderId,
					providerFolderRef: ref,
					createdAt: now,
					updatedAt: now,
				})
				.onConflictDoNothing();
		}
	}
}

function deleteMessageByProviderRef(
	db: SyncDatabaseClient,
	accountId: string,
	providerRef: string,
) {
	return Effect.tryPromise(async () => {
		const [msg] = await db
			.select({ id: mailMessage.id, conversationId: mailMessage.conversationId })
			.from(mailMessage)
			.where(
				and(eq(mailMessage.accountId, accountId), eq(mailMessage.providerMessageRef, providerRef)),
			)
			.limit(1);

		if (msg) {
			// Cascading deletes handle body parts, labels, mailbox entries, attachments
			await db.delete(mailMessage).where(eq(mailMessage.id, msg.id));

			if (msg.conversationId) {
				await recomputeConversationStats(db, msg.conversationId);
			}
		}
	});
}

function addMessageLabels(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	messageRef: string,
	labelRefs: string[],
) {
	return Effect.tryPromise(async () => {
		const [msg] = await db
			.select({ id: mailMessage.id, conversationId: mailMessage.conversationId })
			.from(mailMessage)
			.where(
				and(eq(mailMessage.accountId, accountId), eq(mailMessage.providerMessageRef, messageRef)),
			)
			.limit(1);

		if (!msg) return;

		const dbLabels = await db
			.select({ id: mailLabel.id, providerLabelRef: mailLabel.providerLabelRef })
			.from(mailLabel)
			.where(eq(mailLabel.accountId, accountId));

		const refToId = new Map(dbLabels.map((l) => [l.providerLabelRef, l.id]));
		const now = new Date();

		for (const ref of labelRefs) {
			const labelId = refToId.get(ref);
			if (labelId) {
				await db
					.insert(mailMessageLabel)
					.values({ userId, messageId: msg.id, labelId, createdAt: now, updatedAt: now })
					.onConflictDoNothing();
			}
		}

		// Update UNREAD/STARRED flags
		if (labelRefs.includes("UNREAD")) {
			await db
				.update(mailMessage)
				.set({ isUnread: true, updatedAt: now })
				.where(eq(mailMessage.id, msg.id));
		}
		if (labelRefs.includes("STARRED")) {
			await db
				.update(mailMessage)
				.set({ isStarred: true, updatedAt: now })
				.where(eq(mailMessage.id, msg.id));
		}

		const currentLabelRefs = await getCurrentMessageLabelRefs(db, msg.id);
		await syncMessageFolderMembershipImpl(db, userId, accountId, msg.id, currentLabelRefs);

		if (msg.conversationId && labelRefs.includes("UNREAD")) {
			await recomputeConversationStats(db, msg.conversationId);
		}
	});
}

function removeMessageLabels(
	db: SyncDatabaseClient,
	accountId: string,
	messageRef: string,
	labelRefs: string[],
) {
	return Effect.tryPromise(async () => {
		const [msg] = await db
			.select({
				id: mailMessage.id,
				userId: mailMessage.userId,
				conversationId: mailMessage.conversationId,
			})
			.from(mailMessage)
			.where(
				and(eq(mailMessage.accountId, accountId), eq(mailMessage.providerMessageRef, messageRef)),
			)
			.limit(1);

		if (!msg) return;

		const dbLabels = await db
			.select({ id: mailLabel.id, providerLabelRef: mailLabel.providerLabelRef })
			.from(mailLabel)
			.where(eq(mailLabel.accountId, accountId));

		const refToId = new Map(dbLabels.map((l) => [l.providerLabelRef, l.id]));
		const now = new Date();

		for (const ref of labelRefs) {
			const labelId = refToId.get(ref);
			if (labelId) {
				await db
					.delete(mailMessageLabel)
					.where(
						and(eq(mailMessageLabel.messageId, msg.id), eq(mailMessageLabel.labelId, labelId)),
					);
			}
		}

		// Update UNREAD/STARRED flags
		if (labelRefs.includes("UNREAD")) {
			await db
				.update(mailMessage)
				.set({ isUnread: false, updatedAt: now })
				.where(eq(mailMessage.id, msg.id));
		}
		if (labelRefs.includes("STARRED")) {
			await db
				.update(mailMessage)
				.set({ isStarred: false, updatedAt: now })
				.where(eq(mailMessage.id, msg.id));
		}

		const currentLabelRefs = await getCurrentMessageLabelRefs(db, msg.id);
		await syncMessageFolderMembershipImpl(db, msg.userId, accountId, msg.id, currentLabelRefs);

		if (msg.conversationId && labelRefs.includes("UNREAD")) {
			await recomputeConversationStats(db, msg.conversationId);
		}
	});
}

// ---------------------------------------------------------------------------
// Sync cursor
// ---------------------------------------------------------------------------

async function upsertSyncCursorImpl(
	db: SyncDatabaseClient,
	accountId: string,
	historyId: string,
): Promise<void> {
	const now = new Date();
	await db
		.insert(mailAccountSyncState)
		.values({
			id: createMailAccountSyncStateId(),
			accountId,
			provider: "gmail",
			stateKind: "gmail_history",
			payload: { historyId },
			lastSuccessfulSyncAt: now,
			lastAttemptedSyncAt: now,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [mailAccountSyncState.accountId, mailAccountSyncState.stateKind],
			set: {
				provider: "gmail",
				payload: { historyId },
				lastSuccessfulSyncAt: now,
				lastAttemptedSyncAt: now,
				lastErrorCode: null,
				lastErrorMessage: null,
				updatedAt: now,
			},
		});
}

function upsertSyncCursor(db: SyncDatabaseClient, accountId: string, historyId: string) {
	return Effect.tryPromise(() => upsertSyncCursorImpl(db, accountId, historyId));
}
