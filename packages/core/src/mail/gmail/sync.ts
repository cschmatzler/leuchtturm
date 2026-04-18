import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Effect, Layer, ServiceMap } from "effect";

import { Database } from "@leuchtturm/core/drizzle";
import { MailContentStorage } from "@leuchtturm/core/mail/content-storage";
import {
	getGmailFolders,
	GmailAdapter,
	type GmailHistoryChangesResult,
	type GmailProviderFolder,
	type GmailProviderLabel,
	type GmailProviderMessage,
	type GmailProviderThread,
} from "@leuchtturm/core/mail/gmail/adapter";
import {
	buildMailParticipantInputs,
	buildMailSearchDocumentValues,
	buildMessageParticipantViews,
	collectConversationParticipants,
	createProviderPayloadDigest,
	type MessageParticipantViews,
	type PersistedMessageParticipant,
	uniqueConversationAddresses,
} from "@leuchtturm/core/mail/ingest";
import {
	mailAccount,
	mailAccountSyncState,
	mailAttachment,
	mailConversation,
	mailConversationFolder,
	mailConversationLabel,
	mailConversationRender,
	mailFolder,
	mailFolderSyncState,
	mailLabel,
	mailMessage,
	mailMessageHeader,
	mailMessageLabel,
	mailMessageMailbox,
	mailMessageParticipant,
	mailMessageSource,
	mailParticipant,
	mailProviderState,
	mailSearchDocument,
} from "@leuchtturm/core/mail/mail.sql";
import {
	buildConversationRenderBundle,
	buildMessageRenderBundle,
	decodeMessageRenderBundle,
	MAIL_RENDER_PARSER_VERSION,
	MAIL_RENDER_SANITIZER_VERSION,
	type MessageRenderBundle,
} from "@leuchtturm/core/mail/render";
import {
	createMailAccountSyncStateId,
	createMailAttachmentId,
	createMailConversationId,
	createMailFolderId,
	createMailFolderSyncStateId,
	createMailLabelId,
	createMailMessageId,
	createMailMessageMailboxId,
	createMailMessageParticipantId,
	createMailMessageSourceId,
	createMailParticipantId,
	createMailProviderStateId,
} from "@leuchtturm/core/mail/schema";

type Db = Database.Executor;
type MailContent = MailContentStorage.Interface;
type MailAccountRecord = typeof mailAccount.$inferSelect;

const PROVIDER = "gmail";
const FOLDER_SYNC_STATE_KIND = "gmail_folder_projection";
const HISTORY_SYNC_STATE_KIND = "gmail_history";
const RAW_SOURCE_KIND = "gmail_full_message";
const MESSAGE_RENDER_SOURCE_KIND = "render_bundle";
const PROVIDER_FOLDER_OBJECT = "gmail_folder";
const PROVIDER_LABEL_OBJECT = "gmail_label";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const WATCH_RENEWAL_BUFFER_MS = 24 * 60 * 60 * 1000;
const WATCH_SYNC_STATE_KIND = "gmail_watch";

const EMPTY_PARTICIPANT_VIEWS: MessageParticipantViews = {
	bccRecipients: [],
	ccRecipients: [],
	replyTo: [],
	sender: null,
	toRecipients: [],
};

async function labelRefMap(db: Db, accountId: string) {
	const rows = await db
		.select({ id: mailLabel.id, ref: mailLabel.providerLabelRef })
		.from(mailLabel)
		.where(eq(mailLabel.accountId, accountId));
	return new Map(rows.map((r) => [r.ref, r.id]));
}

async function folderRefMap(db: Db, accountId: string) {
	const rows = await db
		.select({ id: mailFolder.id, ref: mailFolder.providerFolderRef })
		.from(mailFolder)
		.where(eq(mailFolder.accountId, accountId));
	return new Map(rows.map((r) => [r.ref, r.id]));
}

async function findMessage(db: Db, accountId: string, providerRef: string) {
	const [row] = await db
		.select({
			id: mailMessage.id,
			conversationId: mailMessage.conversationId,
			userId: mailMessage.userId,
		})
		.from(mailMessage)
		.where(
			and(eq(mailMessage.accountId, accountId), eq(mailMessage.providerMessageRef, providerRef)),
		)
		.limit(1);
	return row;
}

function healthyAccountUpdate(now: Date) {
	return {
		status: "healthy" as const,
		lastSuccessfulSyncAt: now,
		lastAttemptedSyncAt: now,
		lastErrorCode: null,
		lastErrorMessage: null,
		degradedReason: null,
	};
}

function toSyncError(context: string, error: unknown): Error {
	return new Error(`${context}: ${String(error)}`);
}

function registerWatch(
	db: Db,
	accountId: string,
	adapter: GmailAdapter,
	topicName: string,
): Effect.Effect<void, Error> {
	return Effect.gen(function* () {
		const { expiration } = yield* adapter.watch(topicName);
		const now = new Date();
		yield* Effect.tryPromise({
			try: () =>
				db
					.insert(mailAccountSyncState)
					.values({
						id: createMailAccountSyncStateId(),
						accountId,
						provider: PROVIDER,
						stateKind: WATCH_SYNC_STATE_KIND,
						payload: { expiration },
						lastSuccessfulSyncAt: now,
						lastAttemptedSyncAt: now,
						createdAt: now,
						updatedAt: now,
					})
					.onConflictDoUpdate({
						target: [mailAccountSyncState.accountId, mailAccountSyncState.stateKind],
						set: {
							provider: PROVIDER,
							payload: { expiration },
							lastSuccessfulSyncAt: now,
							lastAttemptedSyncAt: now,
							lastErrorCode: null,
							lastErrorMessage: null,
							updatedAt: now,
						},
					}),
			catch: (error) => (error instanceof Error ? error : new Error(String(error))),
		});
	});
}

function renewWatchIfNeeded(
	db: Db,
	accountId: string,
	adapter: GmailAdapter,
	topicName: string,
): Effect.Effect<void, Error> {
	return Effect.gen(function* () {
		const [watchState] = yield* Effect.tryPromise({
			try: () =>
				db
					.select({ payload: mailAccountSyncState.payload })
					.from(mailAccountSyncState)
					.where(
						and(
							eq(mailAccountSyncState.accountId, accountId),
							eq(mailAccountSyncState.stateKind, WATCH_SYNC_STATE_KIND),
						),
					)
					.limit(1),
			catch: (error) => (error instanceof Error ? error : new Error(String(error))),
		});

		const expiration = (watchState?.payload as { expiration?: number })?.expiration ?? 0;
		if (expiration < Date.now() + WATCH_RENEWAL_BUFFER_MS) {
			yield* registerWatch(db, accountId, adapter, topicName);
		}
	});
}

async function loadParticipantViews(
	db: Db,
	messageIds: readonly string[],
): Promise<Map<string, MessageParticipantViews>> {
	if (messageIds.length === 0) return new Map();

	const unique = [...new Set(messageIds)];
	const rows = await db
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
		.where(inArray(mailMessageParticipant.messageId, unique));

	const grouped = new Map<string, PersistedMessageParticipant[]>();
	for (const row of rows as Array<PersistedMessageParticipant & { messageId: string }>) {
		const list = grouped.get(row.messageId) ?? [];
		list.push(row);
		grouped.set(row.messageId, list);
	}

	const result = new Map<string, MessageParticipantViews>();
	for (const id of unique) {
		result.set(id, buildMessageParticipantViews(grouped.get(id) ?? []));
	}
	return result;
}

export namespace GmailSync {
	export interface Interface {
		readonly bootstrapAccount: (
			accountId: string,
			accessToken: string,
			topicName: string,
		) => Effect.Effect<void, Error>;
		readonly syncDelta: (
			accountId: string,
			accessToken: string,
			topicName: string,
		) => Effect.Effect<void, Error>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@leuchtturm/GmailSync") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const { db } = yield* Database.Service;
			const storage = yield* MailContentStorage.Service;

			const loadAccount = Effect.fn("GmailSync.loadAccount")(function* (accountId: string) {
				const [account] = yield* Effect.tryPromise({
					try: () => db.select().from(mailAccount).where(eq(mailAccount.id, accountId)).limit(1),
					catch: (error) => toSyncError(`Failed to load account ${accountId}`, error),
				});

				if (!account) {
					return yield* Effect.fail(new Error(`Account ${accountId} not found`));
				}

				return account;
			});

			const markBootstrapAttempt = Effect.fn("GmailSync.markBootstrapAttempt")(function* (
				accountId: string,
				cutoff: Date,
				now: Date,
			) {
				yield* Effect.tryPromise({
					try: () =>
						db
							.update(mailAccount)
							.set({
								status: "bootstrapping",
								bootstrapCutoffAt: cutoff,
								lastAttemptedSyncAt: now,
							})
							.where(eq(mailAccount.id, accountId)),
					catch: (error) =>
						toSyncError(`Failed to mark account ${accountId} as bootstrapping`, error),
				});
			});

			const listLabels = Effect.fn("GmailSync.listLabels")(function* (adapter: GmailAdapter) {
				return yield* adapter
					.listLabels()
					.pipe(Effect.mapError((error) => toSyncError("Failed to list Gmail labels", error)));
			});

			const listRecentThreads = Effect.fn("GmailSync.listRecentThreads")(function* (
				adapter: GmailAdapter,
				cutoff: Date,
			) {
				return yield* adapter
					.listRecentThreads(cutoff)
					.pipe(
						Effect.mapError((error) => toSyncError("Failed to list recent Gmail threads", error)),
					);
			});

			const getLatestCursor = Effect.fn("GmailSync.getLatestCursor")(function* (
				adapter: GmailAdapter,
			) {
				return yield* adapter
					.getLatestCursor()
					.pipe(
						Effect.mapError((error) => toSyncError("Failed to load latest Gmail cursor", error)),
					);
			});

			const loadBootstrapSnapshot = Effect.fn("GmailSync.loadBootstrapSnapshot")(function* (
				adapter: GmailAdapter,
				cutoff: Date,
			) {
				const [labels, threads, cursor] = yield* Effect.all(
					[listLabels(adapter), listRecentThreads(adapter, cutoff), getLatestCursor(adapter)],
					{ concurrency: 3 },
				);

				return {
					cursor,
					folders: getGmailFolders(labels),
					labels,
					threads,
				};
			});

			const persistBootstrapSnapshot = Effect.fn("GmailSync.persistBootstrapSnapshot")(
				function* (params: {
					account: MailAccountRecord;
					accountId: string;
					cursor: string;
					folders: readonly GmailProviderFolder[];
					labels: readonly GmailProviderLabel[];
					threads: readonly GmailProviderThread[];
				}) {
					yield* Effect.tryPromise({
						try: () =>
							db.transaction(async (tx) => {
								const txDb = tx as unknown as Db;
								await syncLabels(txDb, params.account.userId, params.accountId, params.labels);
								await syncFolders(txDb, params.account.userId, params.accountId, params.folders);
								for (const thread of params.threads) {
									await syncThread(txDb, storage, params.account.userId, params.accountId, thread);
								}
								await upsertSyncCursor(txDb, params.accountId, params.cursor);

								const completedAt = new Date();
								await txDb
									.update(mailAccount)
									.set({
										...healthyAccountUpdate(completedAt),
										bootstrapCompletedAt: completedAt,
									})
									.where(eq(mailAccount.id, params.accountId));
							}),
						catch: (error) =>
							toSyncError(`Failed to persist bootstrap snapshot for ${params.accountId}`, error),
					});
				},
			);

			const persistBootstrapFailure = Effect.fn("GmailSync.persistBootstrapFailure")(function* (
				accountId: string,
				error: unknown,
			) {
				yield* Effect.tryPromise({
					try: () =>
						db
							.update(mailAccount)
							.set({
								status: "degraded",
								lastErrorCode: "bootstrap_failed",
								lastErrorMessage: String(error),
								degradedReason: "Bootstrap sync failed",
							})
							.where(eq(mailAccount.id, accountId)),
					catch: (statusError) =>
						toSyncError(
							`Failed to persist degraded bootstrap status for ${accountId}`,
							statusError,
						),
				});
			});

			const registerWatchEffect = Effect.fn("GmailSync.registerWatch")(function* (
				accountId: string,
				adapter: GmailAdapter,
				topicName: string,
			) {
				yield* registerWatch(db, accountId, adapter, topicName).pipe(
					Effect.mapError((error) =>
						toSyncError(`Failed to register Gmail watch for ${accountId}`, error),
					),
				);
			});

			const registerWatchSafe = Effect.fn("GmailSync.registerWatchSafe")(function* (
				accountId: string,
				adapter: GmailAdapter,
				topicName: string,
			) {
				yield* registerWatchEffect(accountId, adapter, topicName).pipe(
					Effect.catch(() => Effect.logWarning(`Watch registration failed for ${accountId}`)),
				);
			});

			const loadSyncCursor = Effect.fn("GmailSync.loadSyncCursor")(function* (accountId: string) {
				const [cursorState] = yield* Effect.tryPromise({
					try: () =>
						db
							.select()
							.from(mailAccountSyncState)
							.where(
								and(
									eq(mailAccountSyncState.accountId, accountId),
									eq(mailAccountSyncState.stateKind, HISTORY_SYNC_STATE_KIND),
								),
							)
							.limit(1),
					catch: (error) => toSyncError(`Failed to load sync cursor for ${accountId}`, error),
				});

				return cursorState;
			});

			const loadHistoryChanges = Effect.fn("GmailSync.loadHistoryChanges")(function* (
				adapter: GmailAdapter,
				startHistoryId: string,
			) {
				return yield* adapter
					.getHistoryChanges(startHistoryId)
					.pipe(
						Effect.mapError((error) =>
							toSyncError(`Failed to load Gmail history from ${startHistoryId}`, error),
						),
					);
			});

			const markResyncing = Effect.fn("GmailSync.markResyncing")(function* (accountId: string) {
				yield* Effect.tryPromise({
					try: () =>
						db
							.update(mailAccount)
							.set({ status: "resyncing", lastAttemptedSyncAt: new Date() })
							.where(eq(mailAccount.id, accountId)),
					catch: (error) => toSyncError(`Failed to mark account ${accountId} as resyncing`, error),
				});
			});

			const persistResyncSnapshot = Effect.fn("GmailSync.persistResyncSnapshot")(
				function* (params: {
					account: MailAccountRecord;
					accountId: string;
					cursor: string;
					folders: readonly GmailProviderFolder[];
					labels: readonly GmailProviderLabel[];
					threads: readonly GmailProviderThread[];
				}) {
					yield* Effect.tryPromise({
						try: () =>
							db.transaction(async (tx) => {
								const txDb = tx as unknown as Db;
								await syncLabels(txDb, params.account.userId, params.accountId, params.labels);
								await syncFolders(txDb, params.account.userId, params.accountId, params.folders);
								for (const thread of params.threads) {
									await syncThread(txDb, storage, params.account.userId, params.accountId, thread);
								}
								await upsertSyncCursor(txDb, params.accountId, params.cursor);

								await txDb
									.update(mailAccount)
									.set(healthyAccountUpdate(new Date()))
									.where(eq(mailAccount.id, params.accountId));
							}),
						catch: (error) =>
							toSyncError(`Failed to persist resync snapshot for ${params.accountId}`, error),
					});
				},
			);

			const resyncAccount = Effect.fn("GmailSync.resyncAccount")(function* (
				account: MailAccountRecord,
				accountId: string,
				adapter: GmailAdapter,
			) {
				const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
				const snapshot = yield* loadBootstrapSnapshot(adapter, cutoff);
				yield* persistResyncSnapshot({ account, accountId, ...snapshot });
			});

			const persistDeltaChanges = Effect.fn("GmailSync.persistDeltaChanges")(function* (params: {
				account: MailAccountRecord;
				accountId: string;
				changes: GmailHistoryChangesResult["changes"];
				folders: readonly GmailProviderFolder[];
				labels: readonly GmailProviderLabel[];
				newCursor: string;
			}) {
				yield* Effect.tryPromise({
					try: () =>
						db.transaction(async (tx) => {
							const txDb = tx as unknown as Db;

							for (const message of params.changes.messagesAdded) {
								await upsertMessage(
									txDb,
									storage,
									params.account.userId,
									params.accountId,
									message,
								);
							}
							for (const deletedRef of params.changes.messagesDeleted) {
								await deleteMessageByRef(txDb, storage, params.accountId, deletedRef);
							}
							for (const { messageRef, labelRefs } of params.changes.labelsAdded) {
								await addMessageLabels(
									txDb,
									storage,
									params.account.userId,
									params.accountId,
									messageRef,
									labelRefs,
								);
							}
							for (const { messageRef, labelRefs } of params.changes.labelsRemoved) {
								await removeMessageLabels(txDb, storage, params.accountId, messageRef, labelRefs);
							}

							await syncLabels(txDb, params.account.userId, params.accountId, params.labels);
							await syncFolders(txDb, params.account.userId, params.accountId, params.folders);
							await upsertSyncCursor(txDb, params.accountId, params.newCursor);

							await txDb
								.update(mailAccount)
								.set(healthyAccountUpdate(new Date()))
								.where(eq(mailAccount.id, params.accountId));
						}),
					catch: (error) =>
						toSyncError(`Failed to persist delta changes for ${params.accountId}`, error),
				});
			});

			const renewWatchIfNeededEffect = Effect.fn("GmailSync.renewWatchIfNeeded")(function* (
				accountId: string,
				adapter: GmailAdapter,
				topicName: string,
			) {
				yield* renewWatchIfNeeded(db, accountId, adapter, topicName).pipe(
					Effect.mapError((error) =>
						toSyncError(`Failed to renew Gmail watch for ${accountId}`, error),
					),
				);
			});

			const renewWatchIfNeededSafe = Effect.fn("GmailSync.renewWatchIfNeededSafe")(function* (
				accountId: string,
				adapter: GmailAdapter,
				topicName: string,
			) {
				yield* renewWatchIfNeededEffect(accountId, adapter, topicName).pipe(
					Effect.catch(() => Effect.logWarning(`Watch renewal failed for ${accountId}`)),
				);
			});

			const bootstrapAccount = Effect.fn("GmailSync.bootstrapAccount")(
				(accountId: string, accessToken: string, topicName: string) =>
					Effect.gen(function* () {
						const account = yield* loadAccount(accountId);
						const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
						yield* markBootstrapAttempt(accountId, cutoff, new Date());

						const adapter = new GmailAdapter(accessToken);
						const snapshot = yield* loadBootstrapSnapshot(adapter, cutoff);
						yield* persistBootstrapSnapshot({ account, accountId, ...snapshot });
						yield* registerWatchSafe(accountId, adapter, topicName);
					}).pipe(
						Effect.tapError((error) =>
							persistBootstrapFailure(accountId, error).pipe(
								Effect.catch((statusError) => Effect.logWarning(statusError.message)),
							),
						),
					),
			);

			const syncDelta = Effect.fn("GmailSync.syncDelta")(function* (
				accountId: string,
				accessToken: string,
				topicName: string,
			) {
				const account = yield* loadAccount(accountId);
				const adapter = new GmailAdapter(accessToken);
				const cursorState = yield* loadSyncCursor(accountId);

				if (!cursorState) {
					yield* bootstrapAccount(accountId, accessToken, topicName);
					return;
				}

				const startHistoryId = (cursorState.payload as { historyId: string }).historyId;
				const { changes, newCursor, cursorExpired } = yield* loadHistoryChanges(
					adapter,
					startHistoryId,
				);

				if (cursorExpired) {
					yield* markResyncing(accountId);
					yield* resyncAccount(account, accountId, adapter);
					return;
				}

				const labels = yield* listLabels(adapter);
				const folders = getGmailFolders(labels);

				yield* persistDeltaChanges({
					account,
					accountId,
					changes,
					folders,
					labels,
					newCursor,
				});
				yield* renewWatchIfNeededSafe(accountId, adapter, topicName);
			});

			return Service.of({
				bootstrapAccount,
				syncDelta,
			});
		}),
	);

	export const defaultLayer = layer;
}

async function syncLabels(
	db: Db,
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

		await upsertProviderState(
			db,
			accountId,
			PROVIDER_LABEL_OBJECT,
			label.providerRef,
			label.providerStatePayload,
		);
	}

	const dbLabels = await db
		.select({ id: mailLabel.id, path: mailLabel.path, ref: mailLabel.providerLabelRef })
		.from(mailLabel)
		.where(eq(mailLabel.accountId, accountId));

	const pathToId = new Map(dbLabels.filter((l) => l.path).map((l) => [l.path!, l.id]));

	for (const label of labels) {
		const labelId = pathToId.get(label.path ?? "");
		if (!labelId) continue;

		const parentId =
			label.path && label.delimiter
				? (pathToId.get(label.path.split(label.delimiter).slice(0, -1).join(label.delimiter)) ??
					null)
				: null;

		await db.update(mailLabel).set({ parentId, updatedAt: now }).where(eq(mailLabel.id, labelId));
	}

	const currentRefs = new Set(labels.map((l) => l.providerRef));
	const stale = dbLabels.filter((l) => !currentRefs.has(l.ref));

	if (stale.length > 0) {
		const staleIds = stale.map((l) => l.id);
		const staleRefs = stale.map((l) => l.ref);
		await db.delete(mailLabel).where(inArray(mailLabel.id, staleIds));
		await db
			.delete(mailProviderState)
			.where(
				and(
					eq(mailProviderState.accountId, accountId),
					eq(mailProviderState.objectType, PROVIDER_LABEL_OBJECT),
					inArray(mailProviderState.objectId, staleRefs),
				),
			);
	}
}

async function syncFolders(
	db: Db,
	userId: string,
	accountId: string,
	folders: readonly GmailProviderFolder[],
): Promise<void> {
	const now = new Date();

	for (const folder of folders) {
		const depth = folder.path ? folder.path.split(folder.delimiter ?? "/").length - 1 : 0;
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
				depth,
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
					depth,
					parentId: null,
					isSelectable: folder.isSelectable,
					updatedAt: now,
				},
			});

		await upsertProviderState(
			db,
			accountId,
			PROVIDER_FOLDER_OBJECT,
			folder.providerRef,
			folder.providerStatePayload,
		);
	}

	const dbFolders = await db
		.select({ id: mailFolder.id, ref: mailFolder.providerFolderRef })
		.from(mailFolder)
		.where(eq(mailFolder.accountId, accountId));

	const refToId = new Map(dbFolders.map((f) => [f.ref, f.id]));
	for (const folder of folders) {
		const folderId = refToId.get(folder.providerRef);
		if (folderId) {
			await upsertFolderSyncState(db, accountId, folderId, folder.providerStatePayload);
		}
	}

	const currentRefs = new Set(folders.map((f) => f.providerRef));
	const stale = dbFolders.filter((f) => !currentRefs.has(f.ref));

	if (stale.length > 0) {
		const staleIds = stale.map((f) => f.id);
		const staleRefs = stale.map((f) => f.ref);
		await db.delete(mailFolder).where(inArray(mailFolder.id, staleIds));
		await db
			.delete(mailProviderState)
			.where(
				and(
					eq(mailProviderState.accountId, accountId),
					eq(mailProviderState.objectType, PROVIDER_FOLDER_OBJECT),
					inArray(mailProviderState.objectId, staleRefs),
				),
			);
	}
}

async function syncThread(
	db: Db,
	storage: MailContent,
	userId: string,
	accountId: string,
	thread: GmailProviderThread,
): Promise<void> {
	const messages = thread.messages;
	if (messages.length === 0) return;

	const now = new Date();
	const latest = messages[messages.length - 1]!;
	const conversationId = createMailConversationId();

	const conversationValues = {
		subject: messages[0]?.subject ?? null,
		snippet: latest.snippet ?? null,
		latestMessageAt: latest.receivedAt ?? now,
		latestMessageId: null,
		latestSender: latest.sender ?? null,
		participantsPreview: collectConversationParticipants(messages),
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

	const resolvedId = conversation?.id ?? conversationId;

	for (const message of messages) {
		await upsertMessage(db, storage, userId, accountId, message, resolvedId, {
			recomputeConversation: false,
		});
	}
	await recomputeConversationStats(db, storage, resolvedId);
}

async function ensureConversation(
	db: Db,
	userId: string,
	accountId: string,
	message: GmailProviderMessage,
): Promise<string | undefined> {
	if (!message.threadRef) return undefined;

	const now = new Date();
	const conversationId = createMailConversationId();

	const conversationValues = {
		subject: message.subject ?? null,
		snippet: message.snippet ?? null,
		latestMessageAt: message.receivedAt ?? now,
		latestMessageId: null,
		latestSender: message.sender ?? null,
		participantsPreview: collectConversationParticipants([message]),
		messageCount: 0,
		unreadCount: 0,
		hasAttachments: false,
		isStarred: false,
		draftCount: 0,
		updatedAt: now,
	};

	const [conversation] = await db
		.insert(mailConversation)
		.values({
			id: conversationId,
			userId,
			accountId,
			providerConversationRef: message.threadRef,
			...conversationValues,
			createdAt: now,
		})
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
	db: Db,
	storage: MailContent,
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
		await deleteConversationRender(db, storage, conversationId);
		await db.delete(mailConversation).where(eq(mailConversation.id, conversationId));
		return;
	}

	const latest = messages[0]!;
	const views = await loadParticipantViews(
		db,
		messages.map((m) => m.id),
	);

	const participantsPreview = uniqueConversationAddresses(
		messages.flatMap((msg) => {
			const v = views.get(msg.id);
			return [v?.sender ?? undefined, ...(v?.toRecipients ?? []), ...(v?.ccRecipients ?? [])];
		}),
	);

	await db
		.update(mailConversation)
		.set({
			subject: latest.subject,
			snippet: latest.snippet,
			latestMessageAt: latest.receivedAt ?? latest.createdAt,
			latestMessageId: latest.id,
			latestSender: (views.get(latest.id) ?? EMPTY_PARTICIPANT_VIEWS).sender,
			participantsPreview,
			messageCount: messages.length,
			unreadCount: messages.filter((m) => m.isUnread).length,
			hasAttachments: messages.some((m) => m.hasAttachments),
			isStarred: messages.some((m) => m.isStarred),
			draftCount: messages.filter((m) => m.isDraft).length,
			updatedAt: new Date(),
		})
		.where(eq(mailConversation.id, conversationId));

	await recomputeProjections(db, latest.userId, latest.accountId, conversationId);
	await rebuildConversationRender(db, storage, conversationId);
}

async function recomputeProjections(
	db: Db,
	userId: string,
	accountId: string,
	conversationId: string,
): Promise<void> {
	const messageIds = await db
		.select({ id: mailMessage.id })
		.from(mailMessage)
		.where(eq(mailMessage.conversationId, conversationId));

	if (messageIds.length === 0) return;

	const idList = messageIds.map((m) => m.id);
	const labelRows = await db
		.select({ labelId: mailMessageLabel.labelId })
		.from(mailMessageLabel)
		.where(inArray(mailMessageLabel.messageId, idList));
	const folderRows = await db
		.select({ folderId: mailMessageMailbox.folderId })
		.from(mailMessageMailbox)
		.where(inArray(mailMessageMailbox.messageId, idList));

	const now = new Date();
	const labelIds = [...new Set(labelRows.map((r) => r.labelId))];
	const folderIds = [...new Set(folderRows.map((r) => r.folderId))];

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

async function upsertMessage(
	db: Db,
	storage: MailContent,
	userId: string,
	accountId: string,
	message: GmailProviderMessage,
	conversationId?: string,
	options?: {
		readonly recomputeConversation?: boolean;
	},
): Promise<void> {
	const now = new Date();
	const resolvedConversationId =
		conversationId ?? (await ensureConversation(db, userId, accountId, message));

	const hasHtml = message.bodyParts.some((bp) => bp.contentType === "text/html");
	const hasPlainText = message.bodyParts.some((bp) => bp.contentType === "text/plain");

	const existing = await findMessage(db, accountId, message.providerRef);
	const messageId = existing?.id ?? createMailMessageId();
	const nextConversationId = resolvedConversationId ?? existing?.conversationId ?? null;

	const values = {
		conversationId: nextConversationId,
		internetMessageId: message.internetMessageId ?? null,
		subject: message.subject ?? null,
		snippet: message.snippet ?? null,
		sentAt: message.sentAt ?? null,
		receivedAt: message.receivedAt ?? null,
		isUnread: message.isUnread,
		isStarred: message.isStarred,
		isDraft: message.isDraft,
		hasAttachments: message.attachments.length > 0,
		hasHtml,
		hasPlainText,
		updatedAt: now,
	};

	if (existing) {
		await db.update(mailMessage).set(values).where(eq(mailMessage.id, existing.id));
	} else {
		await db.insert(mailMessage).values({
			id: messageId,
			userId,
			accountId,
			providerMessageRef: message.providerRef,
			createdAt: now,
			...values,
		});
	}

	const messageRenderBundle = buildMessageRenderBundle({
		messageId,
		bodyParts: message.bodyParts,
		parserVersion: MAIL_RENDER_PARSER_VERSION,
		sanitizerVersion: MAIL_RENDER_SANITIZER_VERSION,
	});

	await replaceAttachments(db, userId, messageId, message.attachments);
	await syncMessageHeader(db, userId, messageId, message.headers);
	await syncParticipants(db, userId, messageId, message);

	if (message.labelRefs) {
		await syncMessageLabels(db, userId, accountId, messageId, message.labelRefs);
		await syncFolderMembership(db, userId, accountId, messageId, message.labelRefs);
	} else {
		await db.delete(mailMessageLabel).where(eq(mailMessageLabel.messageId, messageId));
		await db.delete(mailMessageMailbox).where(eq(mailMessageMailbox.messageId, messageId));
	}

	await upsertMessageSources(db, storage, {
		accountId,
		messageId,
		providerPayload: message.providerStatePayload,
		messageRenderBundle,
	});
	await rebuildSearchDocument(db, messageId, message.bodyParts);

	if (nextConversationId && options?.recomputeConversation !== false) {
		await recomputeConversationStats(db, storage, nextConversationId);
	}
}

async function replaceAttachments(
	db: Db,
	userId: string,
	messageId: string,
	attachments: GmailProviderMessage["attachments"],
): Promise<void> {
	const now = new Date();
	await db.delete(mailAttachment).where(eq(mailAttachment.messageId, messageId));

	for (const att of attachments) {
		await db.insert(mailAttachment).values({
			id: createMailAttachmentId(),
			userId,
			messageId,
			providerAttachmentRef: att.providerRef ?? null,
			filename: att.filename ?? null,
			mimeType: att.mimeType ?? null,
			size: att.size ?? null,
			isInline: att.isInline,
			contentId: att.contentId ?? null,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function syncMessageHeader(
	db: Db,
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

async function cleanupOrphanedParticipants(
	db: Db,
	userId: string,
	participantIds: readonly string[],
): Promise<void> {
	if (participantIds.length === 0) return;

	const unique = [...new Set(participantIds)];
	const remaining = await db
		.select({ participantId: mailMessageParticipant.participantId })
		.from(mailMessageParticipant)
		.where(inArray(mailMessageParticipant.participantId, unique));

	const active = new Set(remaining.map((r) => r.participantId));
	const orphaned = unique.filter((id) => !active.has(id));

	if (orphaned.length > 0) {
		await db
			.delete(mailParticipant)
			.where(and(eq(mailParticipant.userId, userId), inArray(mailParticipant.id, orphaned)));
	}
}

async function syncParticipants(
	db: Db,
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

		const [persisted] = await db
			.select({ id: mailParticipant.id })
			.from(mailParticipant)
			.where(
				and(
					eq(mailParticipant.userId, userId),
					eq(mailParticipant.normalizedAddress, participant.normalizedAddress),
				),
			)
			.limit(1);

		if (!persisted) continue;

		await db
			.insert(mailMessageParticipant)
			.values({
				id: createMailMessageParticipantId(),
				userId,
				messageId,
				participantId: persisted.id,
				role: participant.role,
				ordinal: participant.ordinal,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();
	}

	await cleanupOrphanedParticipants(
		db,
		userId,
		previousRefs.map((r) => r.participantId),
	);
}

async function getCurrentLabelRefs(db: Db, messageId: string): Promise<string[]> {
	const rows = await db
		.select({ ref: mailLabel.providerLabelRef })
		.from(mailMessageLabel)
		.innerJoin(mailLabel, eq(mailMessageLabel.labelId, mailLabel.id))
		.where(eq(mailMessageLabel.messageId, messageId));
	return rows.map((r) => r.ref);
}

async function syncMessageLabels(
	db: Db,
	userId: string,
	accountId: string,
	messageId: string,
	labelRefs: readonly string[],
): Promise<void> {
	const now = new Date();
	const refs = await labelRefMap(db, accountId);
	await db.delete(mailMessageLabel).where(eq(mailMessageLabel.messageId, messageId));

	for (const ref of labelRefs) {
		const labelId = refs.get(ref);
		if (!labelId) continue;
		await db
			.insert(mailMessageLabel)
			.values({ accountId, userId, messageId, labelId, createdAt: now, updatedAt: now })
			.onConflictDoNothing();
	}
}

async function syncFolderMembership(
	db: Db,
	userId: string,
	accountId: string,
	messageId: string,
	labelRefs: readonly string[],
): Promise<void> {
	const now = new Date();
	const refs = await folderRefMap(db, accountId);
	await db.delete(mailMessageMailbox).where(eq(mailMessageMailbox.messageId, messageId));

	for (const ref of labelRefs) {
		const folderId = refs.get(ref);
		if (!folderId) continue;
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

async function updateMessageFlags(
	db: Db,
	messageId: string,
	labelRefs: readonly string[],
	present: boolean,
): Promise<void> {
	const updates: Partial<Record<"isDraft" | "isStarred" | "isUnread", boolean>> = {};
	if (labelRefs.includes("UNREAD")) updates.isUnread = present;
	if (labelRefs.includes("STARRED")) updates.isStarred = present;
	if (labelRefs.includes("DRAFT")) updates.isDraft = present;
	if (Object.keys(updates).length === 0) return;

	await db
		.update(mailMessage)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(mailMessage.id, messageId));
}

async function addMessageLabels(
	db: Db,
	storage: MailContent,
	userId: string,
	accountId: string,
	messageRef: string,
	labelRefs: readonly string[],
): Promise<void> {
	const message = await findMessage(db, accountId, messageRef);
	if (!message) return;

	const now = new Date();
	const refs = await labelRefMap(db, accountId);

	for (const ref of labelRefs) {
		const labelId = refs.get(ref);
		if (!labelId) continue;
		await db
			.insert(mailMessageLabel)
			.values({ accountId, userId, messageId: message.id, labelId, createdAt: now, updatedAt: now })
			.onConflictDoNothing();
	}

	await updateMessageFlags(db, message.id, labelRefs, true);
	const currentRefs = await getCurrentLabelRefs(db, message.id);
	await syncFolderMembership(db, userId, accountId, message.id, currentRefs);
	await rebuildSearchDocument(db, message.id);

	if (message.conversationId) {
		await recomputeConversationStats(db, storage, message.conversationId);
	}
}

async function removeMessageLabels(
	db: Db,
	storage: MailContent,
	accountId: string,
	messageRef: string,
	labelRefs: readonly string[],
): Promise<void> {
	const message = await findMessage(db, accountId, messageRef);
	if (!message) return;

	const refs = await labelRefMap(db, accountId);
	for (const ref of labelRefs) {
		const labelId = refs.get(ref);
		if (!labelId) continue;
		await db
			.delete(mailMessageLabel)
			.where(
				and(eq(mailMessageLabel.messageId, message.id), eq(mailMessageLabel.labelId, labelId)),
			);
	}

	await updateMessageFlags(db, message.id, labelRefs, false);
	const currentRefs = await getCurrentLabelRefs(db, message.id);
	await syncFolderMembership(db, message.userId, accountId, message.id, currentRefs);
	await rebuildSearchDocument(db, message.id);

	if (message.conversationId) {
		await recomputeConversationStats(db, storage, message.conversationId);
	}
}

async function deleteMessageByRef(
	db: Db,
	storage: MailContent,
	accountId: string,
	providerRef: string,
): Promise<void> {
	const message = await findMessage(db, accountId, providerRef);
	if (!message) return;

	const participantRefs = await db
		.select({ participantId: mailMessageParticipant.participantId })
		.from(mailMessageParticipant)
		.where(eq(mailMessageParticipant.messageId, message.id));
	const sourceRows = await db
		.select({
			storageKey: mailMessageSource.storageKey,
			storageKind: mailMessageSource.storageKind,
		})
		.from(mailMessageSource)
		.where(eq(mailMessageSource.messageId, message.id));
	const r2SourceKeys = sourceRows
		.filter((row) => row.storageKind === "r2")
		.map((row) => row.storageKey);

	await db
		.update(mailConversation)
		.set({ latestMessageId: null, updatedAt: new Date() })
		.where(eq(mailConversation.latestMessageId, message.id));
	await db.delete(mailMessage).where(eq(mailMessage.id, message.id));
	await Effect.runPromise(storage.deleteKeys(r2SourceKeys));

	await cleanupOrphanedParticipants(
		db,
		message.userId,
		participantRefs.map((r) => r.participantId),
	);

	if (message.conversationId) {
		await recomputeConversationStats(db, storage, message.conversationId);
	}
}

async function upsertProviderState(
	db: Db,
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
			provider: PROVIDER,
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
			set: { provider: PROVIDER, payload, updatedAt: now },
		});
}

async function upsertFolderSyncState(
	db: Db,
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
			provider: PROVIDER,
			stateKind: FOLDER_SYNC_STATE_KIND,
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
				provider: PROVIDER,
				payload,
				lastSuccessfulSyncAt: now,
				lastAttemptedSyncAt: now,
				lastErrorCode: null,
				lastErrorMessage: null,
				updatedAt: now,
			},
		});
}

function messageRawStorageKey(accountId: string, messageId: string): string {
	return `mail/${accountId}/messages/${messageId}/raw/${RAW_SOURCE_KIND}.json`;
}

function messageRenderStorageKey(accountId: string, messageId: string): string {
	return `mail/${accountId}/messages/${messageId}/render-bundle.json`;
}

function conversationRenderStorageKey(accountId: string, conversationId: string): string {
	return `mail/${accountId}/conversations/${conversationId}/render-bundle.json`;
}

function emptyMessageRenderBundle(messageId: string): MessageRenderBundle {
	return {
		version: 1,
		messageId,
		preferredKind: "text",
		html: null,
		text: null,
		parserVersion: MAIL_RENDER_PARSER_VERSION,
		sanitizerVersion: MAIL_RENDER_SANITIZER_VERSION,
	};
}

async function upsertMessageSourcePointer(
	db: Db,
	values: {
		readonly messageId: string;
		readonly sourceKind: string;
		readonly storageKey: string;
		readonly contentSha256: string;
		readonly byteSize: number;
		readonly parserVersion: string | null;
		readonly sanitizerVersion: string | null;
	},
): Promise<void> {
	const now = new Date();
	await db
		.insert(mailMessageSource)
		.values({
			id: createMailMessageSourceId(),
			messageId: values.messageId,
			sourceKind: values.sourceKind,
			storageKind: "r2",
			storageKey: values.storageKey,
			contentSha256: values.contentSha256,
			byteSize: values.byteSize,
			parserVersion: values.parserVersion,
			sanitizerVersion: values.sanitizerVersion,
			encryptionMetadata: null,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [mailMessageSource.messageId, mailMessageSource.sourceKind],
			set: {
				storageKind: "r2",
				storageKey: values.storageKey,
				contentSha256: values.contentSha256,
				byteSize: values.byteSize,
				parserVersion: values.parserVersion,
				sanitizerVersion: values.sanitizerVersion,
				encryptionMetadata: null,
				updatedAt: now,
			},
		});
}

async function upsertMessageSources(
	db: Db,
	storage: MailContent,
	values: {
		readonly accountId: string;
		readonly messageId: string;
		readonly providerPayload: unknown;
		readonly messageRenderBundle: MessageRenderBundle;
	},
): Promise<void> {
	const rawDigest = createProviderPayloadDigest(values.providerPayload);
	const rawStorageKey = messageRawStorageKey(values.accountId, values.messageId);
	await Effect.runPromise(storage.putText(rawStorageKey, rawDigest.json));
	await upsertMessageSourcePointer(db, {
		messageId: values.messageId,
		sourceKind: RAW_SOURCE_KIND,
		storageKey: rawStorageKey,
		contentSha256: rawDigest.contentSha256,
		byteSize: rawDigest.byteSize,
		parserVersion: MAIL_RENDER_PARSER_VERSION,
		sanitizerVersion: null,
	});

	const renderDigest = createProviderPayloadDigest(values.messageRenderBundle);
	const renderStorageKey = messageRenderStorageKey(values.accountId, values.messageId);
	await Effect.runPromise(storage.putText(renderStorageKey, renderDigest.json));
	await upsertMessageSourcePointer(db, {
		messageId: values.messageId,
		sourceKind: MESSAGE_RENDER_SOURCE_KIND,
		storageKey: renderStorageKey,
		contentSha256: renderDigest.contentSha256,
		byteSize: renderDigest.byteSize,
		parserVersion: MAIL_RENDER_PARSER_VERSION,
		sanitizerVersion: MAIL_RENDER_SANITIZER_VERSION,
	});
}

async function deleteConversationRender(
	db: Db,
	storage: MailContent,
	conversationId: string,
): Promise<void> {
	const [existing] = await db
		.select({
			storageKey: mailConversationRender.storageKey,
			storageKind: mailConversationRender.storageKind,
		})
		.from(mailConversationRender)
		.where(eq(mailConversationRender.conversationId, conversationId))
		.limit(1);

	await db
		.delete(mailConversationRender)
		.where(eq(mailConversationRender.conversationId, conversationId));

	if (existing?.storageKind === "r2") {
		await Effect.runPromise(storage.deleteKeys([existing.storageKey]));
	}
}

async function rebuildConversationRender(
	db: Db,
	storage: MailContent,
	conversationId: string,
): Promise<void> {
	const [conversation] = await db
		.select({
			id: mailConversation.id,
			accountId: mailConversation.accountId,
			userId: mailConversation.userId,
		})
		.from(mailConversation)
		.where(eq(mailConversation.id, conversationId))
		.limit(1);

	if (!conversation) {
		await deleteConversationRender(db, storage, conversationId);
		return;
	}

	const messages = await db
		.select({
			id: mailMessage.id,
			receivedAt: mailMessage.receivedAt,
			createdAt: mailMessage.createdAt,
		})
		.from(mailMessage)
		.where(eq(mailMessage.conversationId, conversationId))
		.orderBy(sql`${mailMessage.receivedAt} asc nulls last`, mailMessage.createdAt);

	if (messages.length === 0) {
		await deleteConversationRender(db, storage, conversationId);
		return;
	}

	const messageIds = messages.map((message) => message.id);
	const sourceRows = await db
		.select({ messageId: mailMessageSource.messageId, storageKey: mailMessageSource.storageKey })
		.from(mailMessageSource)
		.where(
			and(
				inArray(mailMessageSource.messageId, messageIds),
				eq(mailMessageSource.sourceKind, MESSAGE_RENDER_SOURCE_KIND),
				eq(mailMessageSource.storageKind, "r2"),
			),
		);
	const sourceByMessageId = new Map(sourceRows.map((row) => [row.messageId, row.storageKey]));

	const renderedMessages: Array<{ messageId: string; bundle: MessageRenderBundle }> = [];
	for (const message of messages) {
		const storageKey = sourceByMessageId.get(message.id);
		if (!storageKey) {
			renderedMessages.push({
				messageId: message.id,
				bundle: emptyMessageRenderBundle(message.id),
			});
			continue;
		}

		const raw = await Effect.runPromise(storage.getText(storageKey));
		if (!raw) {
			renderedMessages.push({
				messageId: message.id,
				bundle: emptyMessageRenderBundle(message.id),
			});
			continue;
		}

		renderedMessages.push({
			messageId: message.id,
			bundle: decodeMessageRenderBundle(JSON.parse(raw)),
		});
	}

	const conversationBundle = buildConversationRenderBundle({
		conversationId,
		parserVersion: MAIL_RENDER_PARSER_VERSION,
		sanitizerVersion: MAIL_RENDER_SANITIZER_VERSION,
		messages: renderedMessages,
	});
	const digest = createProviderPayloadDigest(conversationBundle);
	const storageKey = conversationRenderStorageKey(conversation.accountId, conversationId);

	await Effect.runPromise(storage.putText(storageKey, digest.json));

	const now = new Date();
	await db
		.insert(mailConversationRender)
		.values({
			conversationId,
			accountId: conversation.accountId,
			userId: conversation.userId,
			storageKind: "r2",
			storageKey,
			contentSha256: digest.contentSha256,
			byteSize: digest.byteSize,
			messageCount: renderedMessages.length,
			parserVersion: MAIL_RENDER_PARSER_VERSION,
			sanitizerVersion: MAIL_RENDER_SANITIZER_VERSION,
			encryptionMetadata: null,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [mailConversationRender.conversationId],
			set: {
				accountId: conversation.accountId,
				userId: conversation.userId,
				storageKind: "r2",
				storageKey,
				contentSha256: digest.contentSha256,
				byteSize: digest.byteSize,
				messageCount: renderedMessages.length,
				parserVersion: MAIL_RENDER_PARSER_VERSION,
				sanitizerVersion: MAIL_RENDER_SANITIZER_VERSION,
				encryptionMetadata: null,
				updatedAt: now,
			},
		});
}

async function rebuildSearchDocument(
	db: Db,
	messageId: string,
	bodyParts?: readonly { content: string; contentType: "text/html" | "text/plain" }[],
): Promise<void> {
	const [msg] = await db
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

	if (!msg) return;

	const [existingDoc] = await db
		.select({
			bodyText: mailSearchDocument.bodyText,
			mirroredCoverageKind: mailSearchDocument.mirroredCoverageKind,
		})
		.from(mailSearchDocument)
		.where(eq(mailSearchDocument.messageId, messageId))
		.limit(1);

	const participants =
		(await loadParticipantViews(db, [messageId])).get(messageId) ?? EMPTY_PARTICIPANT_VIEWS;
	const labelRows = await db
		.select({ labelId: mailMessageLabel.labelId })
		.from(mailMessageLabel)
		.where(eq(mailMessageLabel.messageId, messageId));
	const folderRows = await db
		.select({ folderId: mailMessageMailbox.folderId })
		.from(mailMessageMailbox)
		.where(eq(mailMessageMailbox.messageId, messageId));

	const nextSearchValues = buildMailSearchDocumentValues({
		bccRecipients: participants.bccRecipients,
		bodyParts: bodyParts ?? [],
		ccRecipients: participants.ccRecipients,
		sender: participants.sender,
		snippet: msg.snippet,
		subject: msg.subject,
		toRecipients: participants.toRecipients,
	});

	const searchValues = bodyParts
		? nextSearchValues
		: {
				...nextSearchValues,
				bodyText: existingDoc?.bodyText ?? nextSearchValues.bodyText,
				mirroredCoverageKind:
					existingDoc?.mirroredCoverageKind ?? nextSearchValues.mirroredCoverageKind,
			};

	const now = new Date();
	const docValues = {
		userId: msg.userId,
		accountId: msg.accountId,
		conversationId: msg.conversationId,
		folderIds: folderRows.map((r) => r.folderId),
		labelIds: labelRows.map((r) => r.labelId),
		...searchValues,
		updatedAt: now,
	};

	await db
		.insert(mailSearchDocument)
		.values({ messageId: msg.id, ...docValues, createdAt: now })
		.onConflictDoUpdate({ target: [mailSearchDocument.messageId], set: docValues });
}

async function upsertSyncCursor(db: Db, accountId: string, historyId: string): Promise<void> {
	const now = new Date();
	await db
		.insert(mailAccountSyncState)
		.values({
			id: createMailAccountSyncStateId(),
			accountId,
			provider: PROVIDER,
			stateKind: HISTORY_SYNC_STATE_KIND,
			payload: { historyId },
			lastSuccessfulSyncAt: now,
			lastAttemptedSyncAt: now,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [mailAccountSyncState.accountId, mailAccountSyncState.stateKind],
			set: {
				provider: PROVIDER,
				payload: { historyId },
				lastSuccessfulSyncAt: now,
				lastAttemptedSyncAt: now,
				lastErrorCode: null,
				lastErrorMessage: null,
				updatedAt: now,
			},
		});
}
