/**
 * Gmail OAuth2 connection flow, account disconnection, and Pub/Sub webhook.
 *
 * Bootstrap sync is triggered after OAuth callback.
 * Incremental sync is driven by Gmail Pub/Sub push notifications.
 */

import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { Database } from "@chevrotain/core/drizzle";
import { DatabaseError, ValidationError } from "@chevrotain/core/errors";
import { MailEncryption } from "@chevrotain/core/mail/encryption";
import { GmailOAuth } from "@chevrotain/core/mail/gmail/oauth";
import { Gmail } from "@chevrotain/core/mail/gmail/workflows";
import {
	consumeMailOAuthState,
	createMailAccount,
	createMailAccountSecret,
	createMailOAuthState,
	disconnectMailAccount,
	getMailAccountByEmail,
	getMailAccountForUser,
} from "@chevrotain/core/mail/queries";
import { createMailAccountId, createMailOAuthStateId } from "@chevrotain/core/mail/schema";

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

				const url = yield* oauth
					.getAuthUrl(state)
					.pipe(Effect.mapError((error) => toDatabaseError("Failed to build OAuth URL", error)));

				return { url };
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

				const tokens = yield* oauth
					.exchangeCode(payload.code)
					.pipe(Effect.mapError((error) => toDatabaseError("OAuth code exchange failed", error)));

				const userInfo = yield* oauth
					.getUserInfo(tokens.accessToken)
					.pipe(
						Effect.mapError((error) => toDatabaseError("Failed to fetch Google user info", error)),
					);

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
						}),
					catch: (error) => toDatabaseError("Failed to create mail account", error),
				});

				const encrypted = yield* encryption
					.encrypt(
						JSON.stringify({
							accessToken: tokens.accessToken,
							refreshToken: tokens.refreshToken,
							expiresAt: Date.now() + tokens.expiresIn * 1000,
						}),
					)
					.pipe(
						Effect.mapError((error) =>
							toDatabaseError("Failed to encrypt mail credentials", error),
						),
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

				yield* Gmail.BootstrapWorkflow.execute(
					{ accountId, accessToken: tokens.accessToken },
					{ discard: true },
				);

				return { accountId };
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

// ---------------------------------------------------------------------------
// Webhook handler (no auth — receives Google Pub/Sub push notifications)
// ---------------------------------------------------------------------------

export const WebhookHandlerLive = HttpApiBuilder.group(ChevrotainApi, "webhook", (handlers) =>
	handlers.handle(
		"gmailPush",
		Effect.fn("webhook.gmailPush")(function* ({ payload }) {
			const raw = payload.message?.data;
			if (!raw) {
				return { success: true as const };
			}

			const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as {
				emailAddress?: string;
			};

			if (!decoded.emailAddress) {
				return { success: true as const };
			}

			const { db } = yield* Database.Service;
			const account = yield* Effect.tryPromise({
				try: () => getMailAccountByEmail(db, decoded.emailAddress!),
				catch: (error) => toDatabaseError("Failed to look up account", error),
			});

			if (!account) {
				// Unknown email — ack without processing
				return { success: true as const };
			}

			yield* Gmail.DeltaWorkflow.execute({ accountId: account.id }, { discard: true });

			return { success: true as const };
		}),
	),
);
