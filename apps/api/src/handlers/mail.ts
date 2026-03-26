/**
 * Mail API handlers.
 *
 * Handles Gmail OAuth2 connection flow and account disconnection.
 * Sync orchestration is delegated to durable workflows.
 */

import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { Database } from "@chevrotain/core/drizzle/index";
import { DatabaseError, ValidationError } from "@chevrotain/core/errors";
import { MailEncryption } from "@chevrotain/core/mail/encryption";
import { GmailOAuth } from "@chevrotain/core/mail/gmail/oauth";
import { GmailSyncWorkflow } from "@chevrotain/core/mail/gmail/workflows";
import {
	consumeMailOAuthState,
	createMailAccount,
	createMailAccountSecret,
	createMailOAuthState,
	disconnectMailAccount,
	getMailAccountForUser,
} from "@chevrotain/core/mail/queries";
import {
	createMailAccountId,
	createMailOAuthStateId,
	GMAIL_CAPABILITIES,
} from "@chevrotain/core/mail/schema";

const MAIL_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function toDatabaseError(context: string, error: unknown) {
	return new DatabaseError({
		message: `${context}: ${error instanceof Error ? error.message : String(error)}`,
	});
}

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
				const { user, session } = yield* CurrentUser;
				const { db } = yield* Database.Service;
				const oauth = yield* GmailOAuth.Service;
				const state = createMailOAuthStateId();

				yield* Effect.tryPromise({
					try: () =>
						createMailOAuthState(db, {
							id: state,
							userId: user.id,
							sessionId: session.id,
							expiresAt: new Date(Date.now() + MAIL_OAUTH_STATE_TTL_MS),
						}),
					catch: (error) => toDatabaseError("Failed to create OAuth state", error),
				});

				return { url: oauth.getAuthUrl(state) };
			}),
		)

		// -------------------------------------------------------------------
		// POST /api/mail/oauth/callback
		// -------------------------------------------------------------------
		.handle(
			"mailOAuthCallback",
			Effect.fn("mail.oauthCallback")(function* ({ payload }) {
				const { user, session } = yield* CurrentUser;
				const { db } = yield* Database.Service;
				const oauth = yield* GmailOAuth.Service;
				const encryption = yield* MailEncryption.Service;

				const state = yield* Effect.tryPromise({
					try: () =>
						consumeMailOAuthState(db, {
							id: payload.state,
							userId: user.id,
							sessionId: session.id,
						}),
					catch: (error) => toDatabaseError("Failed to validate OAuth state", error),
				});

				if (!state) {
					return yield* Effect.fail(
						new ValidationError({
							global: [{ message: "Invalid or expired Gmail OAuth state" }],
						}),
					);
				}

				const tokens = yield* Effect.tryPromise({
					try: () => oauth.exchangeCode(payload.code),
					catch: (error) => toDatabaseError("OAuth code exchange failed", error),
				});

				const userInfo = yield* Effect.tryPromise({
					try: () => oauth.getUserInfo(tokens.accessToken),
					catch: (error) => toDatabaseError("Failed to fetch Google user info", error),
				});

				const accountId = createMailAccountId();
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
					catch: (error) => toDatabaseError("Failed to create mail account", error),
				});

				const encrypted = encryption.encrypt(
					JSON.stringify({
						accessToken: tokens.accessToken,
						refreshToken: tokens.refreshToken,
						expiresAt: Date.now() + tokens.expiresIn * 1000,
					}),
				);

				yield* Effect.tryPromise({
					try: () =>
						createMailAccountSecret(db, {
							accountId,
							authKind: "oauth2",
							encryptedPayload: encrypted.encryptedPayload,
							encryptedDek: encrypted.encryptedDek,
						}),
					catch: (error) => toDatabaseError("Failed to store mail credentials", error),
				});

				yield* GmailSyncWorkflow.execute(
					{ accountId, accessToken: tokens.accessToken },
					{ discard: true },
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

				const account = yield* Effect.tryPromise({
					try: () => getMailAccountForUser(db, payload.accountId, user.id),
					catch: (error) => toDatabaseError("Failed to fetch account", error),
				});

				if (!account) {
					return yield* Effect.fail(new DatabaseError({ message: "Account not found" }));
				}

				yield* GmailSyncWorkflow.execute({ accountId: payload.accountId }, { discard: true });

				return { success: true as const };
			}),
		)

		// -------------------------------------------------------------------
		// POST /api/mail/disconnect
		// -------------------------------------------------------------------
		.handle(
			"mailDisconnect",
			Effect.fn("mail.disconnect")(function* ({ payload }) {
				const { user } = yield* CurrentUser;
				const { db } = yield* Database.Service;

				const account = yield* Effect.tryPromise({
					try: () => getMailAccountForUser(db, payload.accountId, user.id),
					catch: (error) => toDatabaseError("Failed to fetch account", error),
				});

				if (!account) {
					return yield* Effect.fail(new DatabaseError({ message: "Account not found" }));
				}

				yield* Effect.tryPromise({
					try: () => disconnectMailAccount(db, payload.accountId),
					catch: (error) => toDatabaseError("Disconnect failed", error),
				});

				return { success: true as const };
			}),
		),
);
