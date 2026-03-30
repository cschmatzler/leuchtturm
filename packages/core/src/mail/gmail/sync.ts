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

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { Database } from "@chevrotain/core/drizzle/index";
import type { DatabaseExecutor } from "@chevrotain/core/drizzle/index";
import {
	getGmailFolders,
	GmailAdapter,
	type GmailProviderFolder,
	type GmailProviderHistoryChange,
	type GmailProviderLabel,
	type GmailProviderMessage,
	type GmailProviderThread,
} from "@chevrotain/core/mail/gmail/adapter";
import {
	buildMailParticipantInputs,
	buildMailSearchDocumentValues,
	buildMessageParticipantViews,
	collectConversationParticipants,
	createProviderPayloadDigest,
	type MessageParticipantViews,
	type PersistedMessageParticipant,
} from "@chevrotain/core/mail/ingest";
import {
	mailAccount,
	mailAccountSyncState,
	mailAttachment,
	mailConversation,
	mailConversationFolder,
	mailConversationLabel,
	mailFolder,
	mailFolderSyncState,
	mailLabel,
	mailMessage,
	mailMessageBodyPart,
	mailMessageHeader,
	mailMessageLabel,
	mailMessageMailbox,
	mailMessageParticipant,
	mailMessageSource,
	mailParticipant,
	mailProviderState,
	mailSearchDocument,
} from "@chevrotain/core/mail/mail.sql";
import {
	ProviderFolder,
	ProviderHistoryChange,
	ProviderLabel,
	ProviderMessage,
	ProviderThread,
} from "@chevrotain/core/mail/provider";
import {
	createMailAccountSyncStateId,
	createMailAttachmentId,
	createMailConversationId,
	createMailFolderId,
	createMailFolderSyncStateId,
	createMailLabelId,
	MailConversationRow,
	MailConversationValues,
	createMailMessageBodyPartId,
	createMailMessageId,
	createMailMessageMailboxId,
	createMailMessageParticipantId,
	createMailMessageSourceId,
	createMailParticipantId,
	createMailProviderStateId,
	MailSearchDocumentRow,
} from "@chevrotain/core/mail/schema";

type SyncDatabaseClient = DatabaseExecutor;

const GMAIL_FOLDER_SYNC_STATE_KIND = "gmail_folder_projection";
const GMAIL_HISTORY_SYNC_STATE_KIND = "gmail_history";
const GMAIL_MESSAGE_SOURCE_KIND = "gmail_full_message";
const GMAIL_MESSAGE_PARSER_VERSION = "gmail-rest-v1";
const GMAIL_PROVIDER = "gmail";
const GMAIL_PROVIDER_FOLDER_OBJECT = "gmail_folder";
const GMAIL_PROVIDER_LABEL_OBJECT = "gmail_label";
const GMAIL_PROVIDER_MESSAGE_OBJECT = "gmail_message";

const decodeProviderFolders = Schema.decodeUnknownSync(Schema.Array(ProviderFolder));
const decodeProviderHistoryChange = Schema.decodeUnknownSync(ProviderHistoryChange);
const decodeProviderLabels = Schema.decodeUnknownSync(Schema.Array(ProviderLabel));
const decodeMailConversationRow = Schema.decodeUnknownSync(MailConversationRow);
const decodeMailConversationValues = Schema.decodeUnknownSync(MailConversationValues);
const decodeMailSearchDocumentRow = Schema.decodeUnknownSync(MailSearchDocumentRow);
const decodeProviderMessage = Schema.decodeUnknownSync(ProviderMessage);
const decodeProviderThreads = Schema.decodeUnknownSync(Schema.Array(ProviderThread));

function assertMailConversationRow<T>(row: T): T {
	return decodeMailConversationRow(row) as T;
}

function assertMailConversationValues<T>(values: T): T {
	return decodeMailConversationValues(values) as T;
}

function assertMailSearchDocumentRow<T>(row: T): T {
	return decodeMailSearchDocumentRow(row) as T;
}

function assertProviderFolders<T extends readonly GmailProviderFolder[]>(folders: T): T {
	decodeProviderFolders(folders);
	return folders;
}

function assertProviderHistoryChange<T extends GmailProviderHistoryChange>(changes: T): T {
	decodeProviderHistoryChange(changes);
	return changes;
}

function assertProviderLabels<T extends readonly GmailProviderLabel[]>(labels: T): T {
	decodeProviderLabels(labels);
	return labels;
}

function assertProviderMessage<T extends GmailProviderMessage>(message: T): T {
	decodeProviderMessage(message);
	return message;
}

function assertProviderThreads<T extends readonly GmailProviderThread[]>(threads: T): T {
	decodeProviderThreads(threads);
	return threads;
}

function runInTransaction<T>(
	db: SyncDatabaseClient,
	callback: (tx: SyncDatabaseClient) => Promise<T>,
): Promise<T> {
	return db.transaction(async (tx) => callback(tx as unknown as SyncDatabaseClient));
}

interface PersistedMessageParticipantRow extends PersistedMessageParticipant {
	readonly messageId: string;
}

function emptyMessageParticipantViews(): MessageParticipantViews {
	return {
		bccRecipients: [],
		ccRecipients: [],
		replyTo: [],
		sender: null,
		toRecipients: [],
	};
}

async function loadMessageParticipantViews(
	db: SyncDatabaseClient,
	messageIds: readonly string[],
): Promise<Map<string, MessageParticipantViews>> {
	const participantViewsByMessageId = new Map<string, MessageParticipantViews>();

	if (messageIds.length === 0) {
		return participantViewsByMessageId;
	}

	const uniqueMessageIds = [...new Set(messageIds)];
	const participantRows = await db
		.select({
			messageId: mailMessageParticipant.messageId,
			role: mailMessageParticipant.role,
			ordinal: mailMessageParticipant.ordinal,
			normalizedAddress: mailParticipant.normalizedAddress,
			displayName: mailParticipant.displayName,
		})
		.from(mailMessageParticipant)
		.innerJoin(
			mailParticipant,
			and(
				eq(mailMessageParticipant.participantId, mailParticipant.id),
				eq(mailMessageParticipant.userId, mailParticipant.userId),
			),
		)
		.where(inArray(mailMessageParticipant.messageId, uniqueMessageIds));

	const participantsByMessageId = new Map<string, PersistedMessageParticipant[]>();

	for (const participantRow of participantRows as PersistedMessageParticipantRow[]) {
		const participants = participantsByMessageId.get(participantRow.messageId) ?? [];
		participants.push({
			displayName: participantRow.displayName,
			normalizedAddress: participantRow.normalizedAddress,
			ordinal: participantRow.ordinal,
			role: participantRow.role,
		});
		participantsByMessageId.set(participantRow.messageId, participants);
	}

	for (const messageId of uniqueMessageIds) {
		participantViewsByMessageId.set(
			messageId,
			buildMessageParticipantViews(participantsByMessageId.get(messageId) ?? []),
		);
	}

	return participantViewsByMessageId;
}

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

		const now = new Date();

		try {
			const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

			yield* Effect.tryPromise(() =>
				db
					.update(mailAccount)
					.set({
						status: "bootstrapping",
						bootstrapCutoffAt: cutoff,
						lastAttemptedSyncAt: now,
					})
					.where(eq(mailAccount.id, accountId)),
			);

			const adapter = new GmailAdapter(accessToken);
			const labels = assertProviderLabels(yield* Effect.tryPromise(() => adapter.listLabels()));
			const folders = assertProviderFolders(getGmailFolders(labels));
			const threads = assertProviderThreads(
				yield* Effect.tryPromise(() => adapter.listRecentThreads(cutoff)),
			);
			const cursor = yield* Effect.tryPromise(() => adapter.getLatestCursor());

			yield* Effect.tryPromise(() =>
				runInTransaction(db, async (tx) => {
					await syncLabelsImpl(tx, account.userId, accountId, labels);
					await syncFoldersImpl(tx, account.userId, accountId, folders);
					for (const thread of threads) {
						await syncThreadImpl(tx, account.userId, accountId, thread);
					}
					await upsertSyncCursorImpl(tx, accountId, cursor);

					const completedAt = new Date();
					await tx
						.update(mailAccount)
						.set({
							status: "healthy",
							bootstrapCompletedAt: completedAt,
							lastSuccessfulSyncAt: completedAt,
							lastAttemptedSyncAt: completedAt,
							lastErrorCode: null,
							lastErrorMessage: null,
							degradedReason: null,
						})
						.where(eq(mailAccount.id, accountId));
				}),
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			yield* Effect.tryPromise(() =>
				db
					.update(mailAccount)
					.set({
						status: "degraded",
						lastErrorCode: "bootstrap_failed",
						lastErrorMessage: errorMessage,
						degradedReason: "Bootstrap sync failed",
					})
					.where(eq(mailAccount.id, accountId)),
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
						eq(mailAccountSyncState.stateKind, GMAIL_HISTORY_SYNC_STATE_KIND),
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
		const validatedChanges = assertProviderHistoryChange(changes);

		if (cursorExpired) {
			yield* Effect.tryPromise(() =>
				db
					.update(mailAccount)
					.set({ status: "resyncing", lastAttemptedSyncAt: new Date() })
					.where(eq(mailAccount.id, accountId)),
			);
			yield* boundedResync(db, account.userId, accountId, adapter);
			return;
		}

		const labels = assertProviderLabels(yield* Effect.tryPromise(() => adapter.listLabels()));
		const folders = assertProviderFolders(getGmailFolders(labels));

		yield* Effect.tryPromise(() =>
			runInTransaction(db, async (tx) => {
				for (const message of validatedChanges.messagesAdded) {
					await upsertMessageImpl(tx, account.userId, accountId, message);
				}

				for (const deletedRef of validatedChanges.messagesDeleted) {
					await deleteMessageByProviderRefImpl(tx, accountId, deletedRef);
				}

				for (const { messageRef, labelRefs } of validatedChanges.labelsAdded) {
					await addMessageLabelsImpl(tx, account.userId, accountId, messageRef, labelRefs);
				}

				for (const { messageRef, labelRefs } of validatedChanges.labelsRemoved) {
					await removeMessageLabelsImpl(tx, accountId, messageRef, labelRefs);
				}

				await syncLabelsImpl(tx, account.userId, accountId, labels);
				await syncFoldersImpl(tx, account.userId, accountId, folders);
				await rebuildSearchDocumentsForAccount(tx, accountId);
				await upsertSyncCursorImpl(tx, accountId, newCursor);

				const syncedAt = new Date();
				await tx
					.update(mailAccount)
					.set({
						status: "healthy",
						lastSuccessfulSyncAt: syncedAt,
						lastAttemptedSyncAt: syncedAt,
						lastErrorCode: null,
						lastErrorMessage: null,
						degradedReason: null,
					})
					.where(eq(mailAccount.id, accountId));
			}),
		);
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
	const labels = assertProviderLabels(await adapter.listLabels());
	const folders = assertProviderFolders(getGmailFolders(labels));
	const threads = assertProviderThreads(await adapter.listRecentThreads(cutoff));
	const cursor = await adapter.getLatestCursor();

	await runInTransaction(db, async (tx) => {
		await syncLabelsImpl(tx, userId, accountId, labels);
		await syncFoldersImpl(tx, userId, accountId, folders);

		// Upsert — repair recent authoritative slice without deleting older mirrored mail.
		for (const thread of threads) {
			await syncThreadImpl(tx, userId, accountId, thread);
		}

		await rebuildSearchDocumentsForAccount(tx, accountId);
		await upsertSyncCursorImpl(tx, accountId, cursor);

		const syncedAt = new Date();
		await tx
			.update(mailAccount)
			.set({
				status: "healthy",
				lastSuccessfulSyncAt: syncedAt,
				lastAttemptedSyncAt: syncedAt,
				lastErrorCode: null,
				lastErrorMessage: null,
				degradedReason: null,
			})
			.where(eq(mailAccount.id, accountId));
	});
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

async function syncLabelsImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	labels: readonly GmailProviderLabel[],
): Promise<void> {
	const now = new Date();

	for (const label of labels) {
		const depth = label.path ? label.path.split(label.delimiter ?? "/").length - 1 : 0;
		await db
			.insert(mailLabel)
			.values({
				id: createMailLabelId(),
				userId,
				accountId,
				providerLabelRef: label.providerRef,
				name: label.name,
				path: label.path ?? null,
				delimiter: label.delimiter ?? null,
				depth,
				color: label.color ?? null,
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
				set: {
					name: label.name,
					path: label.path ?? null,
					delimiter: label.delimiter ?? null,
					depth,
					color: label.color ?? null,
					kind: label.kind,
					updatedAt: now,
				},
			});

		await upsertProviderStateImpl(
			db,
			accountId,
			GMAIL_PROVIDER_LABEL_OBJECT,
			label.providerRef,
			label.providerStatePayload,
		);
	}

	const dbLabels = await db
		.select({
			id: mailLabel.id,
			path: mailLabel.path,
			providerLabelRef: mailLabel.providerLabelRef,
		})
		.from(mailLabel)
		.where(eq(mailLabel.accountId, accountId));

	const pathToId = new Map(
		dbLabels.filter((label) => label.path).map((label) => [label.path!, label.id]),
	);

	for (const label of labels) {
		const labelId = pathToId.get(label.path ?? "");
		if (!labelId) {
			continue;
		}

		const parentId =
			label.path && label.delimiter
				? (pathToId.get(label.path.split(label.delimiter).slice(0, -1).join(label.delimiter)) ??
					null)
				: null;

		await db.update(mailLabel).set({ parentId, updatedAt: now }).where(eq(mailLabel.id, labelId));
	}

	const currentRefs = new Set(labels.map((label) => label.providerRef));
	const staleLabels = dbLabels.filter((label) => !currentRefs.has(label.providerLabelRef));

	if (staleLabels.length > 0) {
		await db.delete(mailLabel).where(
			inArray(
				mailLabel.id,
				staleLabels.map((label) => label.id),
			),
		);
		await db.delete(mailProviderState).where(
			and(
				eq(mailProviderState.accountId, accountId),
				eq(mailProviderState.objectType, GMAIL_PROVIDER_LABEL_OBJECT),
				inArray(
					mailProviderState.objectId,
					staleLabels.map((label) => label.providerLabelRef),
				),
			),
		);
	}
}

async function syncFoldersImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	folders: readonly GmailProviderFolder[],
): Promise<void> {
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
				path: folder.path ?? null,
				delimiter: folder.delimiter ?? null,
				depth: folder.path ? folder.path.split(folder.delimiter ?? "/").length - 1 : 0,
				isSelectable: folder.isSelectable,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [mailFolder.accountId, mailFolder.providerFolderRef],
				targetWhere: and(
					eq(mailFolder.accountId, accountId),
					eq(mailFolder.providerFolderRef, folder.providerRef),
				),
				set: {
					kind: folder.kind,
					name: folder.name,
					path: folder.path ?? null,
					delimiter: folder.delimiter ?? null,
					depth: folder.path ? folder.path.split(folder.delimiter ?? "/").length - 1 : 0,
					parentId: null,
					isSelectable: folder.isSelectable,
					updatedAt: now,
				},
			});

		await upsertProviderStateImpl(
			db,
			accountId,
			GMAIL_PROVIDER_FOLDER_OBJECT,
			folder.providerRef,
			folder.providerStatePayload,
		);
	}

	const dbFolders = await db
		.select({ id: mailFolder.id, providerFolderRef: mailFolder.providerFolderRef })
		.from(mailFolder)
		.where(eq(mailFolder.accountId, accountId));

	const refToId = new Map(dbFolders.map((folder) => [folder.providerFolderRef, folder.id]));

	for (const folder of folders) {
		const folderId = refToId.get(folder.providerRef);
		if (!folderId) {
			continue;
		}

		await upsertFolderSyncStateImpl(db, accountId, folderId, folder.providerStatePayload);
	}

	const currentRefs = new Set(folders.map((folder) => folder.providerRef));
	const staleFolders = dbFolders.filter((folder) => !currentRefs.has(folder.providerFolderRef));

	if (staleFolders.length > 0) {
		await db.delete(mailFolder).where(
			inArray(
				mailFolder.id,
				staleFolders.map((folder) => folder.id),
			),
		);
		await db.delete(mailProviderState).where(
			and(
				eq(mailProviderState.accountId, accountId),
				eq(mailProviderState.objectType, GMAIL_PROVIDER_FOLDER_OBJECT),
				inArray(
					mailProviderState.objectId,
					staleFolders.map((folder) => folder.providerFolderRef),
				),
			),
		);
	}
}

async function syncThreadImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	thread: GmailProviderThread,
): Promise<void> {
	const now = new Date();
	const messages = thread.messages;
	if (messages.length === 0) {
		return;
	}

	const latestMessage = messages[messages.length - 1]!;
	const conversationId = createMailConversationId();
	const subject = messages[0]?.subject ?? null;
	const participantsPreview = collectConversationParticipants(messages);

	const conversationValues = assertMailConversationValues({
		subject,
		snippet: latestMessage.snippet ?? null,
		latestMessageAt: latestMessage.receivedAt ?? now,
		latestMessageId: null,
		latestSender: latestMessage.sender ?? null,
		participantsPreview,
		messageCount: messages.length,
		unreadCount: messages.filter((message) => message.isUnread).length,
		hasAttachments: messages.some((message) => message.attachments.length > 0),
		isStarred: messages.some((message) => message.isStarred),
		draftCount: messages.filter((message) => message.isDraft).length,
		updatedAt: now,
	});
	const conversationRow = assertMailConversationRow({
		id: conversationId,
		userId,
		accountId,
		providerConversationRef: thread.providerRef,
		...conversationValues,
		createdAt: now,
	});

	const [conversation] = await db
		.insert(mailConversation)
		.values(conversationRow)
		.onConflictDoUpdate({
			target: [mailConversation.accountId, mailConversation.providerConversationRef],
			targetWhere: and(
				eq(mailConversation.accountId, accountId),
				eq(mailConversation.providerConversationRef, thread.providerRef),
			),
			set: conversationValues,
		})
		.returning({ id: mailConversation.id });

	const resolvedConversationId = conversation?.id ?? conversationId;

	for (const message of messages) {
		await upsertMessageImpl(db, userId, accountId, message, resolvedConversationId);
	}

	await recomputeConversationProjections(db, userId, accountId, resolvedConversationId);
}

async function ensureConversationForMessage(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	message: GmailProviderMessage,
): Promise<string | undefined> {
	if (!message.threadRef) {
		return undefined;
	}

	const now = new Date();
	const conversationId = createMailConversationId();
	const participantsPreview = collectConversationParticipants([message]);
	const conversationValues = assertMailConversationValues({
		subject: message.subject ?? null,
		snippet: message.snippet ?? null,
		latestMessageAt: message.receivedAt ?? now,
		latestMessageId: null,
		latestSender: message.sender ?? null,
		participantsPreview,
		messageCount: 0,
		unreadCount: 0,
		hasAttachments: false,
		isStarred: false,
		draftCount: 0,
		updatedAt: now,
	});
	const conversationRow = assertMailConversationRow({
		id: conversationId,
		userId,
		accountId,
		providerConversationRef: message.threadRef,
		...conversationValues,
		createdAt: now,
	});
	const [conversation] = await db
		.insert(mailConversation)
		.values(conversationRow)
		.onConflictDoUpdate({
			target: [mailConversation.accountId, mailConversation.providerConversationRef],
			targetWhere: and(
				eq(mailConversation.accountId, accountId),
				eq(mailConversation.providerConversationRef, message.threadRef),
			),
			set: conversationValues,
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
			accountId: mailMessage.accountId,
			createdAt: mailMessage.createdAt,
			id: mailMessage.id,
			hasAttachments: mailMessage.hasAttachments,
			isDraft: mailMessage.isDraft,
			isStarred: mailMessage.isStarred,
			isUnread: mailMessage.isUnread,
			receivedAt: mailMessage.receivedAt,
			snippet: mailMessage.snippet,
			subject: mailMessage.subject,
			userId: mailMessage.userId,
		})
		.from(mailMessage)
		.where(eq(mailMessage.conversationId, conversationId))
		.orderBy(desc(mailMessage.receivedAt), desc(mailMessage.createdAt));

	if (messages.length === 0) {
		await db.delete(mailConversation).where(eq(mailConversation.id, conversationId));
		return;
	}

	const participantViewsByMessageId = await loadMessageParticipantViews(
		db,
		messages.map((message) => message.id),
	);
	const latestMessage = messages[0]!;
	const latestMessageParticipants =
		participantViewsByMessageId.get(latestMessage.id) ?? emptyMessageParticipantViews();
	const participantsPreview = collectConversationParticipants(
		messages.map((message) => {
			const participantViews =
				participantViewsByMessageId.get(message.id) ?? emptyMessageParticipantViews();

			return {
				attachments: [],
				bodyParts: [],
				...(participantViews.ccRecipients.length > 0
					? {
							ccRecipients: participantViews.ccRecipients,
						}
					: {}),
				isDraft: message.isDraft,
				isStarred: message.isStarred,
				isUnread: message.isUnread,
				providerRef: message.id,
				...(participantViews.sender
					? {
							sender: participantViews.sender,
						}
					: {}),
				...(message.snippet ? { snippet: message.snippet } : {}),
				...(message.subject ? { subject: message.subject } : {}),
				...(participantViews.toRecipients.length > 0
					? {
							toRecipients: participantViews.toRecipients,
						}
					: {}),
			} as ProviderMessage;
		}),
	);
	const conversationValues = assertMailConversationValues({
		draftCount: messages.filter((message) => message.isDraft).length,
		hasAttachments: messages.some((message) => message.hasAttachments),
		isStarred: messages.some((message) => message.isStarred),
		latestMessageAt: latestMessage.receivedAt ?? latestMessage.createdAt,
		latestMessageId: latestMessage.id,
		latestSender: latestMessageParticipants.sender,
		messageCount: messages.length,
		participantsPreview,
		snippet: latestMessage.snippet ?? null,
		subject: latestMessage.subject ?? null,
		unreadCount: messages.filter((message) => message.isUnread).length,
		updatedAt: new Date(),
	});

	await db
		.update(mailConversation)
		.set(conversationValues)
		.where(eq(mailConversation.id, conversationId));

	await recomputeConversationProjections(
		db,
		latestMessage.userId,
		latestMessage.accountId,
		conversationId,
	);
}

async function recomputeConversationProjections(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	conversationId: string,
): Promise<void> {
	const messageIds = await db
		.select({ id: mailMessage.id })
		.from(mailMessage)
		.where(eq(mailMessage.conversationId, conversationId));

	if (messageIds.length === 0) {
		return;
	}

	const messageIdList = messageIds.map((message) => message.id);
	const labelRows = await db
		.select({ labelId: mailMessageLabel.labelId })
		.from(mailMessageLabel)
		.where(inArray(mailMessageLabel.messageId, messageIdList));
	const folderRows = await db
		.select({ folderId: mailMessageMailbox.folderId })
		.from(mailMessageMailbox)
		.where(inArray(mailMessageMailbox.messageId, messageIdList));

	const now = new Date();
	const labelIds = Array.from(new Set(labelRows.map((row) => row.labelId)));
	const folderIds = Array.from(new Set(folderRows.map((row) => row.folderId)));

	await db
		.delete(mailConversationLabel)
		.where(eq(mailConversationLabel.conversationId, conversationId));
	for (const labelId of labelIds) {
		await db.insert(mailConversationLabel).values({
			accountId,
			userId,
			conversationId,
			labelId,
			createdAt: now,
			updatedAt: now,
		});
	}

	await db
		.delete(mailConversationFolder)
		.where(eq(mailConversationFolder.conversationId, conversationId));
	for (const folderId of folderIds) {
		await db.insert(mailConversationFolder).values({
			accountId,
			userId,
			conversationId,
			folderId,
			createdAt: now,
			updatedAt: now,
		});
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

async function replaceMessageBodyPartsImpl(
	db: SyncDatabaseClient,
	userId: string,
	messageId: string,
	bodyParts: GmailProviderMessage["bodyParts"],
): Promise<void> {
	const now = new Date();
	await db.delete(mailMessageBodyPart).where(eq(mailMessageBodyPart.messageId, messageId));

	let preferredSet = false;
	const hasHtml = bodyParts.some((bodyPart) => bodyPart.contentType === "text/html");

	for (const [index, bodyPart] of bodyParts.entries()) {
		const isPreferred =
			!preferredSet && (bodyPart.contentType === "text/html" || (index === 0 && !hasHtml));

		await db.insert(mailMessageBodyPart).values({
			id: createMailMessageBodyPartId(),
			userId,
			messageId,
			partIndex: index,
			contentType: bodyPart.contentType,
			content: bodyPart.content,
			isPreferredRender: isPreferred,
			createdAt: now,
			updatedAt: now,
		});

		if (isPreferred) {
			preferredSet = true;
		}
	}
}

async function replaceMessageAttachmentsImpl(
	db: SyncDatabaseClient,
	userId: string,
	messageId: string,
	attachments: GmailProviderMessage["attachments"],
): Promise<void> {
	const now = new Date();
	await db.delete(mailAttachment).where(eq(mailAttachment.messageId, messageId));

	for (const attachment of attachments) {
		await db.insert(mailAttachment).values({
			id: createMailAttachmentId(),
			userId,
			messageId,
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

async function syncMessageHeaderImpl(
	db: SyncDatabaseClient,
	userId: string,
	messageId: string,
	headers: GmailProviderMessage["headers"],
): Promise<void> {
	if (!headers) {
		await db.delete(mailMessageHeader).where(eq(mailMessageHeader.messageId, messageId));
		return;
	}

	const now = new Date();
	await db
		.insert(mailMessageHeader)
		.values({
			messageId,
			userId,
			replyTo: headers.replyTo ?? null,
			inReplyTo: headers.inReplyTo ?? null,
			references: headers.references ?? null,
			listUnsubscribe: headers.listUnsubscribe ?? null,
			listUnsubscribePost: headers.listUnsubscribePost ?? null,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [mailMessageHeader.messageId],
			set: {
				replyTo: headers.replyTo ?? null,
				inReplyTo: headers.inReplyTo ?? null,
				references: headers.references ?? null,
				listUnsubscribe: headers.listUnsubscribe ?? null,
				listUnsubscribePost: headers.listUnsubscribePost ?? null,
				updatedAt: now,
			},
		});
}

async function cleanupParticipantIdsIfOrphaned(
	db: SyncDatabaseClient,
	userId: string,
	participantIds: readonly string[],
): Promise<void> {
	if (participantIds.length === 0) {
		return;
	}

	const remainingRefs = await db
		.select({ participantId: mailMessageParticipant.participantId })
		.from(mailMessageParticipant)
		.where(inArray(mailMessageParticipant.participantId, [...new Set(participantIds)]));

	const activeParticipantIds = new Set(remainingRefs.map((row) => row.participantId));
	const staleParticipantIds = [...new Set(participantIds)].filter(
		(participantId) => !activeParticipantIds.has(participantId),
	);

	if (staleParticipantIds.length > 0) {
		await db
			.delete(mailParticipant)
			.where(
				and(eq(mailParticipant.userId, userId), inArray(mailParticipant.id, staleParticipantIds)),
			);
	}
}

async function syncMessageParticipantsImpl(
	db: SyncDatabaseClient,
	userId: string,
	messageId: string,
	message: GmailProviderMessage,
): Promise<void> {
	const previousRefs = await db
		.select({ participantId: mailMessageParticipant.participantId })
		.from(mailMessageParticipant)
		.where(eq(mailMessageParticipant.messageId, messageId));
	await db.delete(mailMessageParticipant).where(eq(mailMessageParticipant.messageId, messageId));

	const now = new Date();
	const lastSeenAt = message.receivedAt ?? message.sentAt ?? now;
	for (const participant of buildMailParticipantInputs(message)) {
		await db
			.insert(mailParticipant)
			.values({
				id: createMailParticipantId(),
				userId,
				normalizedAddress: participant.normalizedAddress,
				displayName: participant.displayName,
				lastSeenAt,
				sourceKind: "derived_from_mail",
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [mailParticipant.userId, mailParticipant.normalizedAddress],
				set: {
					displayName: sql`coalesce(excluded.display_name, ${mailParticipant.displayName})`,
					lastSeenAt,
					sourceKind: "derived_from_mail",
					updatedAt: now,
				},
			});

		const [persistedParticipant] = await db
			.select({ id: mailParticipant.id })
			.from(mailParticipant)
			.where(
				and(
					eq(mailParticipant.userId, userId),
					eq(mailParticipant.normalizedAddress, participant.normalizedAddress),
				),
			)
			.limit(1);

		if (!persistedParticipant) {
			continue;
		}

		await db
			.insert(mailMessageParticipant)
			.values({
				id: createMailMessageParticipantId(),
				userId,
				messageId,
				participantId: persistedParticipant.id,
				role: participant.role,
				ordinal: participant.ordinal,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();
	}

	await cleanupParticipantIdsIfOrphaned(
		db,
		userId,
		previousRefs.map((participantRef) => participantRef.participantId),
	);
}

async function upsertProviderStateImpl(
	db: SyncDatabaseClient,
	accountId: string,
	objectType: string,
	objectId: string,
	payload: unknown,
): Promise<void> {
	const now = new Date();
	await db
		.insert(mailProviderState)
		.values({
			id: createMailProviderStateId(),
			accountId,
			provider: GMAIL_PROVIDER,
			objectType,
			objectId,
			payload,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [
				mailProviderState.accountId,
				mailProviderState.objectType,
				mailProviderState.objectId,
			],
			set: {
				provider: GMAIL_PROVIDER,
				payload,
				updatedAt: now,
			},
		});
}

async function upsertFolderSyncStateImpl(
	db: SyncDatabaseClient,
	accountId: string,
	folderId: string,
	payload: unknown,
): Promise<void> {
	const now = new Date();
	await db
		.insert(mailFolderSyncState)
		.values({
			id: createMailFolderSyncStateId(),
			accountId,
			folderId,
			provider: GMAIL_PROVIDER,
			stateKind: GMAIL_FOLDER_SYNC_STATE_KIND,
			payload,
			lastSuccessfulSyncAt: now,
			lastAttemptedSyncAt: now,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [
				mailFolderSyncState.accountId,
				mailFolderSyncState.folderId,
				mailFolderSyncState.stateKind,
			],
			set: {
				provider: GMAIL_PROVIDER,
				payload,
				lastSuccessfulSyncAt: now,
				lastAttemptedSyncAt: now,
				lastErrorCode: null,
				lastErrorMessage: null,
				updatedAt: now,
			},
		});
}

async function upsertMessageSourceImpl(
	db: SyncDatabaseClient,
	messageId: string,
	providerRef: string,
	payload: unknown,
): Promise<void> {
	const now = new Date();
	const digest = createProviderPayloadDigest(payload);
	await db
		.insert(mailMessageSource)
		.values({
			id: createMailMessageSourceId(),
			messageId,
			sourceKind: GMAIL_MESSAGE_SOURCE_KIND,
			storageKind: "postgres",
			storageKey: `${GMAIL_PROVIDER_MESSAGE_OBJECT}/${providerRef}`,
			contentSha256: digest.contentSha256,
			byteSize: digest.byteSize,
			parserVersion: GMAIL_MESSAGE_PARSER_VERSION,
			sanitizerVersion: null,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [mailMessageSource.messageId, mailMessageSource.sourceKind],
			set: {
				storageKind: "postgres",
				storageKey: `${GMAIL_PROVIDER_MESSAGE_OBJECT}/${providerRef}`,
				contentSha256: digest.contentSha256,
				byteSize: digest.byteSize,
				parserVersion: GMAIL_MESSAGE_PARSER_VERSION,
				sanitizerVersion: null,
				updatedAt: now,
			},
		});
}

async function rebuildSearchDocumentForMessage(
	db: SyncDatabaseClient,
	messageId: string,
): Promise<void> {
	const [persistedMessage] = await db
		.select({
			accountId: mailMessage.accountId,
			conversationId: mailMessage.conversationId,
			id: mailMessage.id,
			snippet: mailMessage.snippet,
			subject: mailMessage.subject,
			userId: mailMessage.userId,
		})
		.from(mailMessage)
		.where(eq(mailMessage.id, messageId))
		.limit(1);

	if (!persistedMessage) {
		return;
	}

	const messageParticipants =
		(await loadMessageParticipantViews(db, [messageId])).get(messageId) ??
		emptyMessageParticipantViews();

	const bodyParts = await db
		.select({ content: mailMessageBodyPart.content, contentType: mailMessageBodyPart.contentType })
		.from(mailMessageBodyPart)
		.where(eq(mailMessageBodyPart.messageId, messageId));
	const labelRows = await db
		.select({ labelId: mailMessageLabel.labelId })
		.from(mailMessageLabel)
		.where(eq(mailMessageLabel.messageId, messageId));
	const folderRows = await db
		.select({ folderId: mailMessageMailbox.folderId })
		.from(mailMessageMailbox)
		.where(eq(mailMessageMailbox.messageId, messageId));

	const searchValues = buildMailSearchDocumentValues({
		bccRecipients: messageParticipants.bccRecipients,
		bodyParts: bodyParts as Array<{
			content: string;
			contentType: "text/html" | "text/plain";
		}>,
		ccRecipients: messageParticipants.ccRecipients,
		sender: messageParticipants.sender,
		snippet: persistedMessage.snippet,
		subject: persistedMessage.subject,
		toRecipients: messageParticipants.toRecipients,
	});

	const now = new Date();
	const searchDocumentValues = {
		userId: persistedMessage.userId,
		accountId: persistedMessage.accountId,
		conversationId: persistedMessage.conversationId,
		folderIds: folderRows.map((row) => row.folderId),
		labelIds: labelRows.map((row) => row.labelId),
		...searchValues,
		updatedAt: now,
	};
	const searchDocumentRow = assertMailSearchDocumentRow({
		messageId: persistedMessage.id,
		...searchDocumentValues,
		createdAt: now,
	});
	await db
		.insert(mailSearchDocument)
		.values(searchDocumentRow)
		.onConflictDoUpdate({
			target: [mailSearchDocument.messageId],
			set: searchDocumentValues,
		});
}

async function rebuildSearchDocumentsForAccount(
	db: SyncDatabaseClient,
	accountId: string,
): Promise<void> {
	const messages = await db
		.select({ id: mailMessage.id })
		.from(mailMessage)
		.where(eq(mailMessage.accountId, accountId));

	for (const message of messages) {
		await rebuildSearchDocumentForMessage(db, message.id);
	}
}

async function upsertMessageImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	message: GmailProviderMessage,
	conversationId?: string,
): Promise<void> {
	const validatedMessage = assertProviderMessage(message);
	const now = new Date();
	const resolvedConversationId =
		conversationId ?? (await ensureConversationForMessage(db, userId, accountId, validatedMessage));

	const hasHtml = validatedMessage.bodyParts.some(
		(bodyPart) => bodyPart.contentType === "text/html",
	);
	const hasPlainText = validatedMessage.bodyParts.some(
		(bodyPart) => bodyPart.contentType === "text/plain",
	);

	const [existing] = await db
		.select({ id: mailMessage.id, conversationId: mailMessage.conversationId })
		.from(mailMessage)
		.where(
			and(
				eq(mailMessage.accountId, accountId),
				eq(mailMessage.providerMessageRef, validatedMessage.providerRef),
			),
		)
		.limit(1);

	const messageId = existing?.id ?? createMailMessageId();
	const nextConversationId = resolvedConversationId ?? existing?.conversationId ?? null;
	const nextMessageValues = {
		conversationId: nextConversationId,
		internetMessageId: validatedMessage.internetMessageId ?? null,
		subject: validatedMessage.subject ?? null,
		snippet: validatedMessage.snippet ?? null,
		sentAt: validatedMessage.sentAt ?? null,
		receivedAt: validatedMessage.receivedAt ?? null,
		isUnread: validatedMessage.isUnread,
		isStarred: validatedMessage.isStarred,
		isDraft: validatedMessage.isDraft,
		hasAttachments: validatedMessage.attachments.length > 0,
		hasHtml,
		hasPlainText,
		updatedAt: now,
	};

	if (existing) {
		await db.update(mailMessage).set(nextMessageValues).where(eq(mailMessage.id, existing.id));
	} else {
		await db.insert(mailMessage).values({
			id: messageId,
			userId,
			accountId,
			providerMessageRef: validatedMessage.providerRef,
			createdAt: now,
			...nextMessageValues,
		});
	}

	await replaceMessageBodyPartsImpl(db, userId, messageId, validatedMessage.bodyParts);
	await replaceMessageAttachmentsImpl(db, userId, messageId, validatedMessage.attachments);
	await syncMessageHeaderImpl(db, userId, messageId, validatedMessage.headers);
	await syncMessageParticipantsImpl(db, userId, messageId, validatedMessage);

	if (validatedMessage.labelRefs) {
		await syncMessageLabelsImpl(db, userId, accountId, messageId, validatedMessage.labelRefs);
		await syncMessageFolderMembershipImpl(
			db,
			userId,
			accountId,
			messageId,
			validatedMessage.labelRefs,
		);
	} else {
		await db.delete(mailMessageLabel).where(eq(mailMessageLabel.messageId, messageId));
		await db.delete(mailMessageMailbox).where(eq(mailMessageMailbox.messageId, messageId));
	}

	await upsertProviderStateImpl(
		db,
		accountId,
		GMAIL_PROVIDER_MESSAGE_OBJECT,
		validatedMessage.providerRef,
		validatedMessage.providerStatePayload,
	);
	await upsertMessageSourceImpl(
		db,
		messageId,
		validatedMessage.providerRef,
		validatedMessage.providerStatePayload,
	);
	await rebuildSearchDocumentForMessage(db, messageId);

	if (nextConversationId) {
		await recomputeConversationStats(db, nextConversationId);
	}
}

async function syncMessageLabelsImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	messageId: string,
	labelRefs: readonly string[],
): Promise<void> {
	const now = new Date();
	const dbLabels = await db
		.select({ id: mailLabel.id, providerLabelRef: mailLabel.providerLabelRef })
		.from(mailLabel)
		.where(eq(mailLabel.accountId, accountId));

	const refToId = new Map(dbLabels.map((label) => [label.providerLabelRef, label.id]));
	await db.delete(mailMessageLabel).where(eq(mailMessageLabel.messageId, messageId));

	for (const ref of labelRefs) {
		const labelId = refToId.get(ref);
		if (!labelId) {
			continue;
		}

		await db
			.insert(mailMessageLabel)
			.values({
				accountId,
				userId,
				messageId,
				labelId,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();
	}
}

async function syncMessageFolderMembershipImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	messageId: string,
	labelRefs: readonly string[],
): Promise<void> {
	const now = new Date();
	const dbFolders = await db
		.select({ id: mailFolder.id, providerFolderRef: mailFolder.providerFolderRef })
		.from(mailFolder)
		.where(eq(mailFolder.accountId, accountId));

	const refToFolderId = new Map(dbFolders.map((folder) => [folder.providerFolderRef, folder.id]));
	await db.delete(mailMessageMailbox).where(eq(mailMessageMailbox.messageId, messageId));

	for (const ref of labelRefs) {
		const folderId = refToFolderId.get(ref);
		if (!folderId) {
			continue;
		}

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

async function deleteMessageByProviderRefImpl(
	db: SyncDatabaseClient,
	accountId: string,
	providerRef: string,
): Promise<void> {
	const [message] = await db
		.select({
			conversationId: mailMessage.conversationId,
			id: mailMessage.id,
			userId: mailMessage.userId,
		})
		.from(mailMessage)
		.where(
			and(eq(mailMessage.accountId, accountId), eq(mailMessage.providerMessageRef, providerRef)),
		)
		.limit(1);

	if (!message) {
		return;
	}

	const participantRefs = await db
		.select({ participantId: mailMessageParticipant.participantId })
		.from(mailMessageParticipant)
		.where(eq(mailMessageParticipant.messageId, message.id));

	await db
		.update(mailConversation)
		.set({ latestMessageId: null, updatedAt: new Date() })
		.where(eq(mailConversation.latestMessageId, message.id));
	await db.delete(mailMessage).where(eq(mailMessage.id, message.id));
	await db
		.delete(mailProviderState)
		.where(
			and(
				eq(mailProviderState.accountId, accountId),
				eq(mailProviderState.objectType, GMAIL_PROVIDER_MESSAGE_OBJECT),
				eq(mailProviderState.objectId, providerRef),
			),
		);
	await cleanupParticipantIdsIfOrphaned(
		db,
		message.userId,
		participantRefs.map((participantRef) => participantRef.participantId),
	);

	if (message.conversationId) {
		await recomputeConversationStats(db, message.conversationId);
	}
}

async function updateMessageFlagsFromLabels(
	db: SyncDatabaseClient,
	messageId: string,
	labelRefs: readonly string[],
	present: boolean,
): Promise<void> {
	const updates: Partial<Record<"isDraft" | "isStarred" | "isUnread", boolean>> = {};
	if (labelRefs.includes("UNREAD")) {
		updates.isUnread = present;
	}
	if (labelRefs.includes("STARRED")) {
		updates.isStarred = present;
	}
	if (labelRefs.includes("DRAFT")) {
		updates.isDraft = present;
	}

	if (Object.keys(updates).length === 0) {
		return;
	}

	await db
		.update(mailMessage)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(mailMessage.id, messageId));
}

async function addMessageLabelsImpl(
	db: SyncDatabaseClient,
	userId: string,
	accountId: string,
	messageRef: string,
	labelRefs: readonly string[],
): Promise<void> {
	const [message] = await db
		.select({ conversationId: mailMessage.conversationId, id: mailMessage.id })
		.from(mailMessage)
		.where(
			and(eq(mailMessage.accountId, accountId), eq(mailMessage.providerMessageRef, messageRef)),
		)
		.limit(1);

	if (!message) {
		return;
	}

	const dbLabels = await db
		.select({ id: mailLabel.id, providerLabelRef: mailLabel.providerLabelRef })
		.from(mailLabel)
		.where(eq(mailLabel.accountId, accountId));

	const refToId = new Map(dbLabels.map((label) => [label.providerLabelRef, label.id]));
	const now = new Date();

	for (const ref of labelRefs) {
		const labelId = refToId.get(ref);
		if (!labelId) {
			continue;
		}

		await db
			.insert(mailMessageLabel)
			.values({
				accountId,
				userId,
				messageId: message.id,
				labelId,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();
	}

	await updateMessageFlagsFromLabels(db, message.id, labelRefs, true);
	const currentLabelRefs = await getCurrentMessageLabelRefs(db, message.id);
	await syncMessageFolderMembershipImpl(db, userId, accountId, message.id, currentLabelRefs);
	await rebuildSearchDocumentForMessage(db, message.id);

	if (message.conversationId) {
		await recomputeConversationStats(db, message.conversationId);
	}
}

async function removeMessageLabelsImpl(
	db: SyncDatabaseClient,
	accountId: string,
	messageRef: string,
	labelRefs: readonly string[],
): Promise<void> {
	const [message] = await db
		.select({
			conversationId: mailMessage.conversationId,
			id: mailMessage.id,
			userId: mailMessage.userId,
		})
		.from(mailMessage)
		.where(
			and(eq(mailMessage.accountId, accountId), eq(mailMessage.providerMessageRef, messageRef)),
		)
		.limit(1);

	if (!message) {
		return;
	}

	const dbLabels = await db
		.select({ id: mailLabel.id, providerLabelRef: mailLabel.providerLabelRef })
		.from(mailLabel)
		.where(eq(mailLabel.accountId, accountId));

	const refToId = new Map(dbLabels.map((label) => [label.providerLabelRef, label.id]));

	for (const ref of labelRefs) {
		const labelId = refToId.get(ref);
		if (!labelId) {
			continue;
		}

		await db
			.delete(mailMessageLabel)
			.where(
				and(eq(mailMessageLabel.messageId, message.id), eq(mailMessageLabel.labelId, labelId)),
			);
	}

	await updateMessageFlagsFromLabels(db, message.id, labelRefs, false);
	const currentLabelRefs = await getCurrentMessageLabelRefs(db, message.id);
	await syncMessageFolderMembershipImpl(
		db,
		message.userId,
		accountId,
		message.id,
		currentLabelRefs,
	);
	await rebuildSearchDocumentForMessage(db, message.id);

	if (message.conversationId) {
		await recomputeConversationStats(db, message.conversationId);
	}
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
			provider: GMAIL_PROVIDER,
			stateKind: GMAIL_HISTORY_SYNC_STATE_KIND,
			payload: { historyId },
			lastSuccessfulSyncAt: now,
			lastAttemptedSyncAt: now,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [mailAccountSyncState.accountId, mailAccountSyncState.stateKind],
			set: {
				provider: GMAIL_PROVIDER,
				payload: { historyId },
				lastSuccessfulSyncAt: now,
				lastAttemptedSyncAt: now,
				lastErrorCode: null,
				lastErrorMessage: null,
				updatedAt: now,
			},
		});
}
