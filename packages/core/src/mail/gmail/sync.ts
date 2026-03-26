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
	mailFolder,
	mailLabel,
	mailMessage,
	mailMessageBodyPart,
	mailMessageLabel,
	mailMessageMailbox,
	mailSyncCursor,
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
	createMailSyncCursorId,
} from "@chevrotain/core/mail/schema";

type SyncDatabaseClient = NodePgDatabase<Record<string, never>, typeof allRelations>;

// ---------------------------------------------------------------------------
// Bootstrap (§13, §25.2)
// ---------------------------------------------------------------------------

/**
 * Run the initial 30-day bootstrap for a Gmail account.
 */
export function bootstrapGmailAccount(accountId: string, accessToken: string) {
	return Effect.gen(function* () {
		const { db } = yield* Database.Service;
		yield* bootstrapGmailAccountImpl(db, accountId, accessToken);
	});
}

// ---------------------------------------------------------------------------
// Incremental sync (§13)
// ---------------------------------------------------------------------------

/**
 * Run an incremental sync for a Gmail account using the history API.
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
				.from(mailSyncCursor)
				.where(
					and(
						eq(mailSyncCursor.accountId, accountId),
						eq(mailSyncCursor.cursorKind, "gmail_history"),
					),
				)
				.limit(1),
		);

		if (!cursorRow) {
			yield* bootstrapGmailAccountImpl(db, accountId, accessToken);
			return;
		}

		const startHistoryId = (cursorRow.cursorPayload as { historyId: string }).historyId;
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

async function syncThreadImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	thread: ProviderThread,
): Promise<void> {
	const now = new Date();
	const messages = thread.messages;
	if (messages.length === 0) return;

	// Upsert conversation
	const latestMessage = messages[messages.length - 1]!;
	const conversationId = createMailConversationId();
	const subject = messages[0]?.subject ?? null;

	const [conversation] = await db
		.insert(mailConversation)
		.values({
			id: conversationId,
			userId,
			accountId,
			providerConversationRef: thread.providerRef,
			subject,
			snippet: latestMessage.snippet ?? null,
			latestMessageAt: latestMessage.receivedAt ?? now,
			messageCount: messages.length,
			unreadCount: messages.filter((m) => m.isUnread).length,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [mailConversation.accountId, mailConversation.providerConversationRef],
			targetWhere: and(
				eq(mailConversation.accountId, accountId),
				eq(mailConversation.providerConversationRef, thread.providerRef),
			),
			set: {
				subject,
				snippet: latestMessage.snippet ?? null,
				latestMessageAt: latestMessage.receivedAt ?? now,
				messageCount: messages.length,
				unreadCount: messages.filter((m) => m.isUnread).length,
				updatedAt: now,
			},
		})
		.returning({ id: mailConversation.id });

	const convId = conversation?.id ?? conversationId;

	// Upsert each message in the thread
	for (const message of messages) {
		await upsertMessageImpl(db, userId, accountId, message, convId);
	}
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
			subject: mailMessage.subject,
			snippet: mailMessage.snippet,
			receivedAt: mailMessage.receivedAt,
			createdAt: mailMessage.createdAt,
		})
		.from(mailMessage)
		.where(eq(mailMessage.conversationId, conversationId))
		.orderBy(desc(mailMessage.receivedAt), desc(mailMessage.createdAt));

	if (messages.length === 0) {
		await db.delete(mailConversation).where(eq(mailConversation.id, conversationId));
		return;
	}

	const latestMessage = messages[0]!;
	await db
		.update(mailConversation)
		.set({
			subject: latestMessage.subject ?? null,
			snippet: latestMessage.snippet ?? null,
			latestMessageAt: latestMessage.receivedAt ?? latestMessage.createdAt,
			messageCount: messages.length,
			unreadCount: messages.filter((message) => message.isUnread).length,
			updatedAt: new Date(),
		})
		.where(eq(mailConversation.id, conversationId));
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
		.insert(mailSyncCursor)
		.values({
			id: createMailSyncCursorId(),
			accountId,
			provider: "gmail",
			cursorKind: "gmail_history",
			cursorPayload: { historyId },
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [mailSyncCursor.accountId, mailSyncCursor.cursorKind],
			set: {
				provider: "gmail",
				cursorPayload: { historyId },
				updatedAt: now,
			},
		});
}

function upsertSyncCursor(db: SyncDatabaseClient, accountId: string, historyId: string) {
	return Effect.tryPromise(() => upsertSyncCursorImpl(db, accountId, historyId));
}
