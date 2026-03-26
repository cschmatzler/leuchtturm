/**
 * Gmail sync service (§13).
 *
 * Handles:
 * - Bootstrap sync (30-day import with full qualifying threads)
 * - Incremental sync via Gmail history API
 * - Bounded resync on cursor expiration
 *
 * Sync concurrency (§25.10): At most one sync job per account, enforced via
 * Postgres advisory locks.
 */

import { eq, and, sql } from "drizzle-orm";
import { Effect } from "effect";

import { Database, type DatabaseClient } from "@chevrotain/core/drizzle/index";
import { createId } from "@chevrotain/core/id";
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

// ---------------------------------------------------------------------------
// Bootstrap (§13, §25.2)
// ---------------------------------------------------------------------------

/**
 * Run the initial 30-day bootstrap for a Gmail account.
 */
export function bootstrapGmailAccount(accountId: string, accessToken: string) {
	return Effect.gen(function* () {
		const { db } = yield* Database.Service;

		// Fetch account
		const [account] = yield* Effect.tryPromise(() =>
			db.select().from(mailAccount).where(eq(mailAccount.id, accountId)).limit(1),
		);
		if (!account) return yield* Effect.fail(new Error(`Account ${accountId} not found`));

		// Acquire advisory lock (§25.10)
		const lockAcquired = yield* acquireAdvisoryLock(db, accountId);
		if (!lockAcquired) {
			return yield* Effect.fail(new Error(`Sync already running for account ${accountId}`));
		}

		try {
			// Set status to bootstrapping
			yield* Effect.tryPromise(() =>
				db
					.update(mailAccount)
					.set({ status: "bootstrapping" })
					.where(eq(mailAccount.id, accountId)),
			);

			const adapter = new GmailAdapter(accessToken);

			// 1. Sync labels
			const labels = yield* Effect.tryPromise(() => adapter.listLabels());
			yield* syncLabels(db, account.userId, accountId, labels);

			// 2. Derive folders from system labels (§25.1)
			const folders = getGmailFolders(labels);
			yield* syncFolders(db, account.userId, accountId, folders);

			// 3. Fetch recent threads (30-day cutoff, full qualifying threads)
			const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const threads = yield* Effect.tryPromise(() => adapter.listRecentThreads(cutoff));

			// 4. Write threads, messages, body parts, attachments, label associations
			yield* syncThreads(db, account.userId, accountId, threads);

			// 5. Store cursor for incremental sync
			const cursor = yield* Effect.tryPromise(() => adapter.getLatestCursor());
			yield* upsertSyncCursor(db, accountId, cursor);

			// 6. Set status to healthy
			yield* Effect.tryPromise(() =>
				db.update(mailAccount).set({ status: "healthy" }).where(eq(mailAccount.id, accountId)),
			);
		} catch (error) {
			yield* Effect.tryPromise(() =>
				db.update(mailAccount).set({ status: "degraded" }).where(eq(mailAccount.id, accountId)),
			);
			throw error;
		} finally {
			yield* releaseAdvisoryLock(db, accountId);
		}
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

		const [account] = yield* Effect.tryPromise(() =>
			db.select().from(mailAccount).where(eq(mailAccount.id, accountId)).limit(1),
		);
		if (!account) return yield* Effect.fail(new Error(`Account ${accountId} not found`));

		const lockAcquired = yield* acquireAdvisoryLock(db, accountId);
		if (!lockAcquired) return;

		try {
			const adapter = new GmailAdapter(accessToken);

			// Get current cursor
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
				// No cursor → need bootstrap
				yield* bootstrapGmailAccount(accountId, accessToken);
				return;
			}

			const startHistoryId = (cursorRow.cursorPayload as { historyId: string }).historyId;

			const { changes, newCursor, cursorExpired } = yield* Effect.tryPromise(() =>
				adapter.getHistoryChanges(startHistoryId),
			);

			if (cursorExpired) {
				// §22: Bounded resync
				yield* Effect.tryPromise(() =>
					db.update(mailAccount).set({ status: "resyncing" }).where(eq(mailAccount.id, accountId)),
				);
				yield* boundedResync(db, account.userId, accountId, adapter);
				return;
			}

			// Process changes
			// New messages
			for (const message of changes.messagesAdded) {
				yield* upsertMessage(db, account.userId, accountId, message);
			}

			// Deleted messages
			for (const deletedRef of changes.messagesDeleted) {
				yield* deleteMessageByProviderRef(db, accountId, deletedRef);
			}

			// Label additions
			for (const { messageRef, labelRefs } of changes.labelsAdded) {
				yield* addMessageLabels(db, account.userId, accountId, messageRef, labelRefs);
			}

			// Label removals
			for (const { messageRef, labelRefs } of changes.labelsRemoved) {
				yield* removeMessageLabels(db, accountId, messageRef, labelRefs);
			}

			// Update cursor
			yield* upsertSyncCursor(db, accountId, newCursor);

			// Re-sync labels in case any were added/removed
			const labels = yield* Effect.tryPromise(() => adapter.listLabels());
			yield* syncLabels(db, account.userId, accountId, labels);
		} finally {
			yield* releaseAdvisoryLock(db, accountId);
		}
	});
}

// ---------------------------------------------------------------------------
// Bounded resync (§25.3)
// ---------------------------------------------------------------------------

async function boundedResyncImpl(
	db: DatabaseClient,
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
	const now = new Date();
	const cursorId = createId("msc_");
	await db
		.insert(mailSyncCursor)
		.values({
			id: cursorId,
			accountId,
			provider: "gmail",
			cursorKind: "gmail_history",
			cursorPayload: { historyId: cursor },
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: mailSyncCursor.id,
			set: { cursorPayload: { historyId: cursor }, updatedAt: now },
		});

	await db.update(mailAccount).set({ status: "healthy" }).where(eq(mailAccount.id, accountId));
}

function boundedResync(
	db: DatabaseClient,
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
	db: DatabaseClient,
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
					id: createId("mlb_"),
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
	db: DatabaseClient,
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
					id: createId("mfl_"),
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
	db: DatabaseClient,
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
	db: DatabaseClient,
	userId: string,
	accountId: string,
	thread: ProviderThread,
): Promise<void> {
	const now = new Date();
	const messages = thread.messages;
	if (messages.length === 0) return;

	// Upsert conversation
	const latestMessage = messages[messages.length - 1]!;
	const conversationId = createId("mcv_");
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
	db: DatabaseClient,
	userId: string,
	accountId: string,
	message: ProviderMessage,
) {
	return Effect.tryPromise(() => upsertMessageImpl(db, userId, accountId, message));
}

async function upsertMessageImpl(
	db: DatabaseClient,
	userId: string,
	accountId: string,
	message: ProviderMessage,
	conversationId?: string,
): Promise<void> {
	const now = new Date();
	const messageId = createId("mmg_");

	const bodyParts = message.bodyParts;
	const hasHtml = bodyParts.some((p) => p.contentType === "text/html");
	const hasPlainText = bodyParts.some((p) => p.contentType === "text/plain");

	// If message already exists, get its ID
	const [existing] = await db
		.select({ id: mailMessage.id })
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
				isUnread: message.isUnread,
				isStarred: message.isStarred,
				isDraft: message.isDraft,
				snippet: message.snippet ?? null,
				updatedAt: now,
			})
			.where(eq(mailMessage.id, existing.id));
	} else {
		// Insert new message
		await db.insert(mailMessage).values({
			id: msgId,
			userId,
			accountId,
			conversationId: conversationId ?? null,
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
				id: createId("mbp_"),
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
				id: createId("mat_"),
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
}

async function syncMessageLabelsImpl(
	db: DatabaseClient,
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
	db: DatabaseClient,
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
					id: createId("mmb_"),
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

function deleteMessageByProviderRef(db: DatabaseClient, accountId: string, providerRef: string) {
	return Effect.tryPromise(async () => {
		const [msg] = await db
			.select({ id: mailMessage.id })
			.from(mailMessage)
			.where(
				and(eq(mailMessage.accountId, accountId), eq(mailMessage.providerMessageRef, providerRef)),
			)
			.limit(1);

		if (msg) {
			// Cascading deletes handle body parts, labels, mailbox entries, attachments
			await db.delete(mailMessage).where(eq(mailMessage.id, msg.id));
		}
	});
}

function addMessageLabels(
	db: DatabaseClient,
	userId: string,
	accountId: string,
	messageRef: string,
	labelRefs: string[],
) {
	return Effect.tryPromise(async () => {
		const [msg] = await db
			.select({ id: mailMessage.id })
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
	});
}

function removeMessageLabels(
	db: DatabaseClient,
	accountId: string,
	messageRef: string,
	labelRefs: string[],
) {
	return Effect.tryPromise(async () => {
		const [msg] = await db
			.select({ id: mailMessage.id })
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
	});
}

// ---------------------------------------------------------------------------
// Sync cursor
// ---------------------------------------------------------------------------

function upsertSyncCursor(db: DatabaseClient, accountId: string, historyId: string) {
	return Effect.tryPromise(async () => {
		const now = new Date();
		const [existing] = await db
			.select({ id: mailSyncCursor.id })
			.from(mailSyncCursor)
			.where(
				and(
					eq(mailSyncCursor.accountId, accountId),
					eq(mailSyncCursor.cursorKind, "gmail_history"),
				),
			)
			.limit(1);

		if (existing) {
			await db
				.update(mailSyncCursor)
				.set({ cursorPayload: { historyId }, updatedAt: now })
				.where(eq(mailSyncCursor.id, existing.id));
		} else {
			await db.insert(mailSyncCursor).values({
				id: createId("msc_"),
				accountId,
				provider: "gmail",
				cursorKind: "gmail_history",
				cursorPayload: { historyId },
				createdAt: now,
				updatedAt: now,
			});
		}
	});
}

// ---------------------------------------------------------------------------
// Advisory lock helpers (§25.10)
// ---------------------------------------------------------------------------

function accountIdToLockKey(accountId: string): number {
	let hash = 0;
	for (let i = 0; i < accountId.length; i++) {
		hash = (hash * 31 + accountId.charCodeAt(i)) | 0;
	}
	return hash;
}

function acquireAdvisoryLock(db: DatabaseClient, accountId: string) {
	return Effect.tryPromise(async () => {
		const key = accountIdToLockKey(accountId);
		const result = await db.execute(sql`SELECT pg_try_advisory_lock(${key}) as acquired`);
		return (result.rows[0] as { acquired: boolean })?.acquired === true;
	});
}

function releaseAdvisoryLock(db: DatabaseClient, accountId: string) {
	return Effect.tryPromise(async () => {
		const key = accountIdToLockKey(accountId);
		await db.execute(sql`SELECT pg_advisory_unlock(${key})`);
	});
}
