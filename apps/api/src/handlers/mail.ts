/**
 * Mail API handlers.
 *
 * Handles Gmail OAuth2 connection flow, sync triggers, and account disconnection.
 */

import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { Database } from "@chevrotain/core/drizzle/index";
import { DatabaseError } from "@chevrotain/core/errors";
import { createId } from "@chevrotain/core/id";
import { MailEncryption } from "@chevrotain/core/mail/encryption";
import { GmailOAuth } from "@chevrotain/core/mail/gmail/oauth";
import { bootstrapGmailAccount, incrementalGmailSync } from "@chevrotain/core/mail/gmail/sync";
import {
	createMailAccount,
	createMailAccountSecret,
	disconnectMailAccount,
	getMailAccountForUser,
	getMailAccountSecret,
} from "@chevrotain/core/mail/queries";
import { GMAIL_CAPABILITIES } from "@chevrotain/core/mail/schema";

// ---------------------------------------------------------------------------
// Handler implementation
// ---------------------------------------------------------------------------

export const MailHandlerLive = HttpApiBuilder.group(ChevrotainApi, "mail", (handlers) =>
	handlers
		// -------------------------------------------------------------------
		// GET /api/mail/oauth/url
		// -------------------------------------------------------------------
		.handle(
			"mailOAuthUrl",
			Effect.fn("mail.oauthUrl")(function* () {
				const oauth = yield* GmailOAuth.Service;
				return { url: oauth.getAuthUrl() };
			}),
		)

		// -------------------------------------------------------------------
		// POST /api/mail/oauth/callback
		// -------------------------------------------------------------------
		.handle(
			"mailOAuthCallback",
			Effect.fn("mail.oauthCallback")(function* ({ payload }) {
				const { user } = yield* CurrentUser;
				const { db } = yield* Database.Service;
				const oauth = yield* GmailOAuth.Service;
				const encryption = yield* MailEncryption.Service;

				// Exchange code for tokens
				const tokens = yield* Effect.tryPromise({
					try: () => oauth.exchangeCode(payload.code),
					catch: (error) =>
						new DatabaseError({
							message: `OAuth error: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				// Get user's email from Google
				const userInfo = yield* Effect.tryPromise({
					try: () => oauth.getUserInfo(tokens.accessToken),
					catch: (error) =>
						new DatabaseError({
							message: `Failed to fetch user info: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				// Create mail account
				const accountId = createId("mac_");

				yield* Effect.tryPromise({
					try: () =>
						createMailAccount(db, {
							id: accountId,
							userId: user.id,
							provider: "gmail",
							email: userInfo.email,
							displayName: userInfo.name ?? null,
							status: "connecting",
							...GMAIL_CAPABILITIES,
						}),
					catch: (error) =>
						new DatabaseError({
							message: `Failed to create account: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				// Encrypt and store secrets
				const secretPayload = JSON.stringify({
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					expiresAt: Date.now() + tokens.expiresIn * 1000,
				});

				const encrypted = encryption.encrypt(secretPayload);

				yield* Effect.tryPromise({
					try: () =>
						createMailAccountSecret(db, {
							accountId,
							authKind: "oauth2",
							encryptedPayload: encrypted.encryptedPayload,
							encryptedDek: encrypted.encryptedDek,
						}),
					catch: (error) =>
						new DatabaseError({
							message: `Failed to store secret: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				// Trigger bootstrap sync in background
				yield* bootstrapGmailAccount(accountId, tokens.accessToken).pipe(
					Effect.tapError((error) =>
						Effect.logError(`Bootstrap failed for ${accountId}: ${error}`),
					),
					Effect.ignore,
					Effect.forkDetach,
				);

				return { accountId };
			}),
		)

		// -------------------------------------------------------------------
		// POST /api/mail/sync
		// -------------------------------------------------------------------
		.handle(
			"mailSync",
			Effect.fn("mail.sync")(function* ({ payload }) {
				const { user } = yield* CurrentUser;
				const { db } = yield* Database.Service;
				const encryption = yield* MailEncryption.Service;

				// Verify account ownership
				const account = yield* Effect.tryPromise({
					try: () => getMailAccountForUser(db, payload.accountId, user.id),
					catch: (error) =>
						new DatabaseError({
							message: `Failed to fetch account: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				if (!account) {
					return yield* Effect.fail(new DatabaseError({ message: "Account not found" }));
				}

				// Decrypt secrets to get access token
				const secret = yield* Effect.tryPromise({
					try: () => getMailAccountSecret(db, payload.accountId),
					catch: (error) =>
						new DatabaseError({
							message: `Failed to fetch secret: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				if (!secret) {
					return yield* Effect.fail(
						new DatabaseError({ message: "Account credentials not found" }),
					);
				}

				const decrypted = JSON.parse(
					encryption.decrypt({
						encryptedPayload: secret.encryptedPayload,
						encryptedDek: secret.encryptedDek,
					}),
				) as { accessToken: string; refreshToken?: string; expiresAt: number };

				// Trigger incremental sync in background
				yield* incrementalGmailSync(payload.accountId, decrypted.accessToken).pipe(
					Effect.tapError((error) =>
						Effect.logError(`Sync failed for ${payload.accountId}: ${error}`),
					),
					Effect.ignore,
					Effect.forkDetach,
				);

				return { success: true as const };
			}),
		)

		// -------------------------------------------------------------------
		// POST /api/mail/disconnect (§25.11)
		// -------------------------------------------------------------------
		.handle(
			"mailDisconnect",
			Effect.fn("mail.disconnect")(function* ({ payload }) {
				const { user } = yield* CurrentUser;
				const { db } = yield* Database.Service;

				// Verify account ownership
				const account = yield* Effect.tryPromise({
					try: () => getMailAccountForUser(db, payload.accountId, user.id),
					catch: (error) =>
						new DatabaseError({
							message: `Failed to fetch account: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				if (!account) {
					return yield* Effect.fail(new DatabaseError({ message: "Account not found" }));
				}

				yield* Effect.tryPromise({
					try: () => disconnectMailAccount(db, payload.accountId),
					catch: (error) =>
						new DatabaseError({
							message: `Disconnect failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				return { success: true as const };
			}),
		),
);
