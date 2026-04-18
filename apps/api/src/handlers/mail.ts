import { Effect, Inspectable, Schema } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Resource } from "sst";

import { AuthMiddleware } from "@leuchtturm/api/auth/http-auth";
import { BackgroundTasks } from "@leuchtturm/api/background";
import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Database } from "@leuchtturm/core/drizzle";
import { Email } from "@leuchtturm/core/email";
import {
	DatabaseError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "@leuchtturm/core/errors";
import { MailContentStorage } from "@leuchtturm/core/mail/content-storage";
import { MailEncryption } from "@leuchtturm/core/mail/encryption";
import { GmailOAuth } from "@leuchtturm/core/mail/gmail/oauth";
import { Gmail } from "@leuchtturm/core/mail/gmail/workflows";
import {
	decodeConversationRenderBundle,
	decodeMessageRenderBundle,
} from "@leuchtturm/core/mail/render";
import {
	createMailAccountId,
	createMailOAuthStateId,
	StoredMailOAuthSecret,
} from "@leuchtturm/core/mail/schema";

export namespace MailHandler {
	export interface GmailBootstrapWorkflowBinding {
		create(options: {
			readonly params: {
				readonly accountId: string;
				readonly accessToken: string;
			};
		}): Promise<unknown>;
	}

	const workflowResource = Resource as unknown as {
		readonly GMAIL_BOOTSTRAP_WORKFLOW: GmailBootstrapWorkflowBinding;
	};

	const decodeStoredMailOAuthSecret = Schema.decodeUnknownSync(StoredMailOAuthSecret);

	interface GoogleTokenInfo {
		readonly aud?: string;
		readonly email?: string;
		readonly email_verified?: boolean | string;
		readonly exp?: string;
		readonly iss?: string;
	}

	const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
	const MESSAGE_RENDER_SOURCE_KIND = "render_bundle";
	const verifiedPushTokenExpirations = new Map<string, number>();

	export const decodeGmailPushData = (
		raw: string,
	): { readonly emailAddress: string } | undefined => {
		try {
			const decodedRaw = Buffer.from(raw, "base64").toString("utf-8");
			const decoded = JSON.parse(decodedRaw) as { readonly emailAddress?: unknown };
			if (typeof decoded.emailAddress !== "string" || decoded.emailAddress.length === 0) {
				return undefined;
			}
			return { emailAddress: decoded.emailAddress.trim().toLowerCase() };
		} catch {
			return undefined;
		}
	};

	export const oauthStateTtlMs = 10 * 60 * 1000;

	export const persistGmailOAuthBootstrapFailure = Effect.fn(
		"mail.persistGmailOAuthBootstrapFailure",
	)(function* (accountId: string, error: Error) {
		const { db } = yield* Database.Service;

		yield* Effect.tryPromise({
			try: () =>
				db.$client.query(
					[
						"update mail_account",
						"set status = $1, last_error_code = $2, last_error_message = $3, degraded_reason = $4, updated_at = $5",
						"where id = $6",
					].join(" "),
					[
						"degraded",
						"oauth_bootstrap_failed",
						error.message,
						"Gmail OAuth bootstrap failed",
						new Date(),
						accountId,
					],
				),
			catch: (persistError) =>
				new DatabaseError({
					message: `Failed to persist Gmail OAuth bootstrap failure for ${accountId}: ${Inspectable.toStringUnknown(persistError)}`,
				}),
		});
	});

	export const verifyGmailPushRequest = Effect.fn("mail.verifyGmailPushRequest")(function* (
		headers: {
			readonly authorization?: string;
			readonly "x-goog-subscription"?: string;
			readonly "x-goog-topic"?: string;
		},
		subscription?: string,
	) {
		if (headers["x-goog-topic"] !== Resource.GmailPubSubTopic.value) {
			return yield* Effect.fail(
				new UnauthorizedError({
					message: "Invalid Gmail push topic",
				}),
			);
		}

		if (subscription) {
			const topic = Resource.GmailPubSubTopic.value;
			const [projectPath] = topic.split("/topics/");
			if (projectPath && !subscription.startsWith(`${projectPath}/subscriptions/`)) {
				return yield* Effect.fail(
					new UnauthorizedError({
						message: "Invalid Gmail push subscription",
					}),
				);
			}
		}

		const token = headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
		if (!token) {
			return yield* Effect.fail(
				new UnauthorizedError({
					message: "Missing Gmail push bearer token",
				}),
			);
		}

		const cachedExpiry = verifiedPushTokenExpirations.get(token);
		if (cachedExpiry && cachedExpiry > Date.now() + 30_000) {
			return;
		}

		const expectedAudience = new URL("/api/webhook/gmail", Resource.ApiConfig.BASE_URL).toString();
		const tokenInfo = yield* Effect.tryPromise({
			try: async () => {
				const response = await fetch(
					`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
				);
				if (!response.ok) {
					throw new Error(`Token verification failed with status ${response.status}`);
				}
				return (await response.json()) as GoogleTokenInfo;
			},
			catch: () =>
				new UnauthorizedError({
					message: "Failed to verify Gmail push bearer token",
				}),
		});

		if (!tokenInfo.aud || tokenInfo.aud !== expectedAudience) {
			return yield* Effect.fail(
				new UnauthorizedError({
					message: "Invalid Gmail push token audience",
				}),
			);
		}

		if (!tokenInfo.iss || !GOOGLE_ISSUERS.has(tokenInfo.iss)) {
			return yield* Effect.fail(
				new UnauthorizedError({
					message: "Invalid Gmail push token issuer",
				}),
			);
		}

		const expMs = Number(tokenInfo.exp ?? "0") * 1000;
		if (!Number.isFinite(expMs) || expMs <= Date.now()) {
			return yield* Effect.fail(
				new UnauthorizedError({
					message: "Expired Gmail push bearer token",
				}),
			);
		}

		if (!(tokenInfo.email_verified === "true" || tokenInfo.email_verified === true)) {
			return yield* Effect.fail(
				new UnauthorizedError({
					message: "Unverified Gmail push token",
				}),
			);
		}

		verifiedPushTokenExpirations.set(token, expMs);
	});

	const oauthUrl = Effect.fn("mail.oauthUrl")(function* () {
		const { user, session } = yield* AuthMiddleware.CurrentUser;
		const email = yield* Email.Service;
		const oauth = yield* GmailOAuth.Service;
		const state = createMailOAuthStateId();

		yield* email
			.createOAuthState({
				id: state,
				userId: user.id,
				sessionId: session.id,
				expiresAt: new Date(Date.now() + oauthStateTtlMs),
			})
			.pipe(
				Effect.mapError(
					(error) =>
						new DatabaseError({ message: `Failed to create OAuth state: ${error.message}` }),
				),
			);

		const url = yield* oauth.getAuthUrl(state);

		return { url };
	});

	const oauthCallback = Effect.fn("mail.oauthCallback")(function* ({ payload }) {
		const { user, session } = yield* AuthMiddleware.CurrentUser;
		const email = yield* Email.Service;
		const oauth = yield* GmailOAuth.Service;
		const encryption = yield* MailEncryption.Service;

		const state = yield* email
			.consumeOAuthState({
				id: payload.state,
				userId: user.id,
				sessionId: session.id,
			})
			.pipe(
				Effect.mapError(
					(error) =>
						new DatabaseError({ message: `Failed to validate OAuth state: ${error.message}` }),
				),
			);

		if (!state) {
			return yield* Effect.fail(
				new ValidationError({
					global: [{ message: "Invalid or expired Gmail OAuth state" }],
				}),
			);
		}

		const tokens = yield* oauth.exchangeCode(payload.code);
		const userInfo = yield* oauth.getUserInfo(tokens.accessToken);
		const normalizedEmail = userInfo.email.trim().toLowerCase();

		const existingAccount = yield* email.getAccountByUserAndEmail(user.id, normalizedEmail).pipe(
			Effect.mapError(
				(error) =>
					new DatabaseError({
						message: `Failed to fetch existing mail account: ${error.message}`,
					}),
			),
		);

		let existingRefreshToken: string | undefined;
		if (existingAccount) {
			const secret = yield* email.getAccountSecret(existingAccount.id).pipe(
				Effect.mapError(
					(error) =>
						new DatabaseError({
							message: `Failed to fetch existing credentials: ${error.message}`,
						}),
				),
			);
			if (secret) {
				const decrypted = yield* encryption
					.decrypt({
						encryptedPayload: secret.encryptedPayload,
						encryptedDek: secret.encryptedDek,
					})
					.pipe(
						Effect.mapError(
							(error) =>
								new DatabaseError({
									message: `Failed to decrypt existing credentials: ${error.message}`,
								}),
						),
					);

				existingRefreshToken = yield* Effect.try({
					try: () => decodeStoredMailOAuthSecret(JSON.parse(decrypted)).refreshToken,
					catch: (error) =>
						new DatabaseError({
							message: `Failed to decode existing credentials: ${error instanceof Error ? error.message : Inspectable.toStringUnknown(error)}`,
						}),
				});
			}
		}

		const refreshToken = tokens.refreshToken ?? existingRefreshToken;
		if (!refreshToken) {
			return yield* Effect.fail(
				new ValidationError({
					global: [
						{
							message: "Gmail did not return a refresh token. Reconnect and grant offline access.",
						},
					],
				}),
			);
		}

		const account = yield* email
			.upsertAccount({
				id: existingAccount?.id ?? createMailAccountId(),
				userId: user.id,
				provider: "gmail",
				email: normalizedEmail,
				displayName: userInfo.name ?? null,
				status: "connecting",
			})
			.pipe(
				Effect.mapError(
					(error) =>
						new DatabaseError({ message: `Failed to upsert mail account: ${error.message}` }),
				),
			);

		yield* Effect.gen(function* () {
			const encrypted = yield* encryption.encrypt(
				JSON.stringify({
					accessToken: tokens.accessToken,
					refreshToken,
					expiresAt: Date.now() + tokens.expiresIn * 1000,
				}),
			);

			yield* email
				.createAccountSecret({
					accountId: account.id,
					authKind: "oauth2",
					encryptedPayload: encrypted.encryptedPayload,
					encryptedDek: encrypted.encryptedDek,
				})
				.pipe(
					Effect.mapError(
						(error) =>
							new DatabaseError({
								message: `Failed to store mail credentials: ${error.message}`,
							}),
					),
				);

			yield* Effect.tryPromise({
				try: () =>
					workflowResource.GMAIL_BOOTSTRAP_WORKFLOW.create({
						params: {
							accountId: account.id,
							accessToken: tokens.accessToken,
						},
					}),
				catch: (error) =>
					new DatabaseError({
						message: `Failed to launch Gmail bootstrap workflow: ${Inspectable.toStringUnknown(error)}`,
					}),
			});

			yield* email.updateAccountStatus(account.id, "bootstrapping").pipe(
				Effect.mapError(
					(error) =>
						new DatabaseError({
							message: `Failed to mark Gmail account as bootstrapping: ${error.message}`,
						}),
				),
			);
		}).pipe(
			Effect.catch((error) =>
				persistGmailOAuthBootstrapFailure(account.id, error).pipe(
					Effect.catch((persistError) =>
						Effect.logWarning(
							`Failed to persist Gmail OAuth bootstrap failure for ${account.id}: ${Inspectable.toStringUnknown(persistError)}`,
						),
					),
					Effect.flatMap(() => Effect.fail(error)),
				),
			),
		);

		return { accountId: account.id as never };
	});

	const loadAccountContentStorageKeys = Effect.fn("mail.loadAccountContentStorageKeys")(function* (
		accountId: string,
	) {
		const { db } = yield* Database.Service;

		const messageRows = yield* Effect.tryPromise({
			try: async () => {
				const result = await db.$client.query<{ storage_key: string }>(
					[
						"select mms.storage_key",
						"from mail_message_source mms",
						"inner join mail_message mm on mm.id = mms.message_id",
						"where mm.account_id = $1 and mms.storage_kind = 'r2'",
					].join(" "),
					[accountId],
				);
				return result.rows;
			},
			catch: (error) =>
				new DatabaseError({
					message: `Failed to load message storage keys for ${accountId}: ${String(error)}`,
				}),
		});

		const conversationRows = yield* Effect.tryPromise({
			try: async () => {
				const result = await db.$client.query<{ storage_key: string }>(
					[
						"select storage_key",
						"from mail_conversation_render",
						"where account_id = $1 and storage_kind = 'r2'",
					].join(" "),
					[accountId],
				);
				return result.rows;
			},
			catch: (error) =>
				new DatabaseError({
					message: `Failed to load conversation storage keys for ${accountId}: ${String(error)}`,
				}),
		});

		return [...new Set([...messageRows, ...conversationRows].map((row) => row.storage_key))];
	});

	const conversationRender = Effect.fn("mail.conversationRender")(function* ({ params }) {
		const { user } = yield* AuthMiddleware.CurrentUser;
		const { db } = yield* Database.Service;
		const storage = yield* MailContentStorage.Service;

		const conversationRows = yield* Effect.tryPromise({
			try: async () => {
				const result = await db.$client.query<{ id: string }>(
					["select id", "from mail_conversation", "where id = $1 and user_id = $2", "limit 1"].join(
						" ",
					),
					[params.conversationId, user.id],
				);
				return result.rows;
			},
			catch: (error) =>
				new DatabaseError({
					message: `Failed to load conversation ${params.conversationId}: ${String(error)}`,
				}),
		});
		const conversation = conversationRows[0];

		if (!conversation) {
			return yield* Effect.fail(new NotFoundError({ resource: "MailConversation" }));
		}

		const pointerRows = yield* Effect.tryPromise({
			try: async () => {
				const result = await db.$client.query<{ storage_key: string }>(
					[
						"select storage_key",
						"from mail_conversation_render",
						"where conversation_id = $1 and user_id = $2",
						"limit 1",
					].join(" "),
					[params.conversationId, user.id],
				);
				return result.rows;
			},
			catch: (error) =>
				new DatabaseError({
					message: `Failed to load conversation render pointer for ${params.conversationId}: ${String(error)}`,
				}),
		});
		const pointer = pointerRows[0] ? { storageKey: pointerRows[0].storage_key } : undefined;

		if (!pointer) {
			return yield* Effect.fail(new NotFoundError({ resource: "MailConversationRender" }));
		}

		const raw = yield* storage
			.getText(pointer.storageKey)
			.pipe(
				Effect.mapError(
					(error) =>
						new DatabaseError({ message: `Failed to read conversation render: ${error.message}` }),
				),
			);

		if (!raw) {
			return yield* Effect.fail(new NotFoundError({ resource: "MailConversationRender" }));
		}

		return yield* Effect.try({
			try: () => decodeConversationRenderBundle(JSON.parse(raw)),
			catch: (error) =>
				new DatabaseError({
					message: `Failed to decode conversation render bundle for ${params.conversationId}: ${String(error)}`,
				}),
		});
	});

	const messageRender = Effect.fn("mail.messageRender")(function* ({ params }) {
		const { user } = yield* AuthMiddleware.CurrentUser;
		const { db } = yield* Database.Service;
		const storage = yield* MailContentStorage.Service;

		const messageRows = yield* Effect.tryPromise({
			try: async () => {
				const result = await db.$client.query<{ id: string }>(
					["select id", "from mail_message", "where id = $1 and user_id = $2", "limit 1"].join(" "),
					[params.messageId, user.id],
				);
				return result.rows;
			},
			catch: (error) =>
				new DatabaseError({
					message: `Failed to load message ${params.messageId}: ${String(error)}`,
				}),
		});
		const message = messageRows[0];

		if (!message) {
			return yield* Effect.fail(new NotFoundError({ resource: "MailMessage" }));
		}

		const pointerRows = yield* Effect.tryPromise({
			try: async () => {
				const result = await db.$client.query<{ storage_key: string }>(
					[
						"select storage_key",
						"from mail_message_source",
						"where message_id = $1 and source_kind = $2 and storage_kind = 'r2'",
						"limit 1",
					].join(" "),
					[params.messageId, MESSAGE_RENDER_SOURCE_KIND],
				);
				return result.rows;
			},
			catch: (error) =>
				new DatabaseError({
					message: `Failed to load message render pointer for ${params.messageId}: ${String(error)}`,
				}),
		});
		const pointer = pointerRows[0] ? { storageKey: pointerRows[0].storage_key } : undefined;

		if (!pointer) {
			return yield* Effect.fail(new NotFoundError({ resource: "MailMessageRender" }));
		}

		const raw = yield* storage
			.getText(pointer.storageKey)
			.pipe(
				Effect.mapError(
					(error) =>
						new DatabaseError({ message: `Failed to read message render: ${error.message}` }),
				),
			);

		if (!raw) {
			return yield* Effect.fail(new NotFoundError({ resource: "MailMessageRender" }));
		}

		return yield* Effect.try({
			try: () => decodeMessageRenderBundle(JSON.parse(raw)),
			catch: (error) =>
				new DatabaseError({
					message: `Failed to decode message render bundle for ${params.messageId}: ${String(error)}`,
				}),
		});
	});

	const disconnect = Effect.fn("mail.disconnect")(function* ({ payload }) {
		const { user } = yield* AuthMiddleware.CurrentUser;
		const email = yield* Email.Service;
		const storage = yield* MailContentStorage.Service;

		const account = yield* email
			.getAccountForUser(payload.accountId, user.id)
			.pipe(
				Effect.mapError(
					(error) => new DatabaseError({ message: `Failed to fetch account: ${error.message}` }),
				),
			);

		if (!account) {
			return yield* Effect.fail(new NotFoundError({ resource: "MailAccount" }));
		}

		yield* Gmail.stopWatch(account.id).pipe(
			Effect.catch((error) =>
				Effect.logWarning(`Failed to stop Gmail watch for ${account.id}: ${String(error)}`),
			),
		);

		const storageKeys = yield* loadAccountContentStorageKeys(account.id);
		yield* storage.deleteKeys(storageKeys).pipe(
			Effect.mapError(
				(error) =>
					new DatabaseError({
						message: `Failed to delete mail content artifacts for ${account.id}: ${error.message}`,
					}),
			),
		);

		yield* email
			.disconnectAccount(payload.accountId)
			.pipe(
				Effect.mapError(
					(error) => new DatabaseError({ message: `Disconnect failed: ${error.message}` }),
				),
			);

		return { success: true as const };
	});

	const gmailPush = Effect.fn("webhook.gmailPush")(function* ({ headers, payload }) {
		yield* verifyGmailPushRequest(headers, payload.subscription);

		const raw = payload.message?.data;
		if (!raw) {
			return { success: true as const };
		}

		const decoded = decodeGmailPushData(raw);
		if (!decoded) {
			return { success: true as const };
		}

		const background = yield* BackgroundTasks.Service;
		const email = yield* Email.Service;
		const accounts = yield* email
			.getAccountsByEmail(decoded.emailAddress)
			.pipe(
				Effect.mapError(
					(error) => new DatabaseError({ message: `Failed to look up accounts: ${error.message}` }),
				),
			);

		const gmailAccounts = accounts.filter((account) => account.provider === "gmail");
		if (gmailAccounts.length === 0) {
			return { success: true as const };
		}

		yield* Effect.forEach(
			gmailAccounts,
			(account) =>
				background.run(
					`Gmail delta failed for ${account.id}`,
					Gmail.DeltaWorkflow.execute({ accountId: account.id }),
				),
			{ concurrency: 4 },
		);

		return { success: true as const };
	});

	export const mailLayer = HttpApiBuilder.group(LeuchtturmApi, "mail", (handlers) =>
		handlers
			.handle("mailOAuthUrl", oauthUrl)
			.handle("mailOAuthCallback", oauthCallback)
			.handle("mailDisconnect", disconnect)
			.handle("mailConversationRender", conversationRender)
			.handle("mailMessageRender", messageRender),
	);

	export const webhookLayer = HttpApiBuilder.group(LeuchtturmApi, "webhook", (handlers) =>
		handlers.handle("gmailPush", gmailPush),
	);
}
