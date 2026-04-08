/**
 * Gmail OAuth2 connection flow, account disconnection, and Pub/Sub webhook.
 *
 * Bootstrap sync is triggered after OAuth callback.
 * Incremental sync is driven by Gmail Pub/Sub push notifications.
 */

import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@leuchtturm/api/auth/http-auth";
import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Database } from "@leuchtturm/core/drizzle";
import { DatabaseError, ValidationError } from "@leuchtturm/core/errors";
import { MailEncryption } from "@leuchtturm/core/mail/encryption";
import { GmailOAuth } from "@leuchtturm/core/mail/gmail/oauth";
import { Gmail } from "@leuchtturm/core/mail/gmail/workflows";
import {
	consumeMailOAuthState,
	createMailAccount,
	createMailAccountSecret,
	createMailOAuthState,
	disconnectMailAccount,
	getMailAccountByEmail,
	getMailAccountForUser,
} from "@leuchtturm/core/mail/queries";
import { createMailAccountId, createMailOAuthStateId } from "@leuchtturm/core/mail/schema";

namespace MailHandlers {
	export const oauthStateTtlMs = 10 * 60 * 1000;

	export const toDatabaseError = (context: string, error: unknown) =>
		new DatabaseError({
			message: `${context}: ${String(error)}`,
		});
}

export namespace MailHandler {
	const oauthUrl = Effect.fn("mail.oauthUrl")(function* () {
		const { user, session } = yield* AuthMiddleware.CurrentUser;
		const { db } = yield* Database.Service;
		const oauth = yield* GmailOAuth.Service;
		const state = createMailOAuthStateId();

		yield* Effect.tryPromise({
			try: () =>
				createMailOAuthState(db, {
					id: state,
					userId: user.id,
					sessionId: session.id,
					expiresAt: new Date(Date.now() + MailHandlers.oauthStateTtlMs),
				}),
			catch: (error) => MailHandlers.toDatabaseError("Failed to create OAuth state", error),
		});

		const url = yield* oauth
			.getAuthUrl(state)
			.pipe(
				Effect.mapError((error) =>
					MailHandlers.toDatabaseError("Failed to build OAuth URL", error),
				),
			);

		return { url };
	});

	const oauthCallback = Effect.fn("mail.oauthCallback")(function* ({ payload }) {
		const { user, session } = yield* AuthMiddleware.CurrentUser;
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
			catch: (error) => MailHandlers.toDatabaseError("Failed to validate OAuth state", error),
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
			.pipe(
				Effect.mapError((error) =>
					MailHandlers.toDatabaseError("OAuth code exchange failed", error),
				),
			);

		const userInfo = yield* oauth
			.getUserInfo(tokens.accessToken)
			.pipe(
				Effect.mapError((error) =>
					MailHandlers.toDatabaseError("Failed to fetch Google user info", error),
				),
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
			catch: (error) => MailHandlers.toDatabaseError("Failed to create mail account", error),
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
					MailHandlers.toDatabaseError("Failed to encrypt mail credentials", error),
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
			catch: (error) => MailHandlers.toDatabaseError("Failed to store mail credentials", error),
		});

		yield* Gmail.BootstrapWorkflow.execute(
			{ accountId, accessToken: tokens.accessToken },
			{ discard: true },
		);

		return { accountId };
	});

	const disconnect = Effect.fn("mail.disconnect")(function* ({ payload }) {
		const { user } = yield* AuthMiddleware.CurrentUser;
		const { db } = yield* Database.Service;

		const account = yield* Effect.tryPromise({
			try: () => getMailAccountForUser(db, payload.accountId, user.id),
			catch: (error) => MailHandlers.toDatabaseError("Failed to fetch account", error),
		});

		if (!account) {
			return yield* Effect.fail(new DatabaseError({ message: "Account not found" }));
		}

		yield* Effect.tryPromise({
			try: () => disconnectMailAccount(db, payload.accountId),
			catch: (error) => MailHandlers.toDatabaseError("Disconnect failed", error),
		});

		return { success: true as const };
	});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "mail", (handlers) =>
		handlers
			.handle("mailOAuthUrl", oauthUrl)
			.handle("mailOAuthCallback", oauthCallback)
			.handle("mailDisconnect", disconnect),
	);
}

export namespace WebhookHandler {
	const gmailPush = Effect.fn("webhook.gmailPush")(function* ({ payload }) {
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
			catch: (error) => MailHandlers.toDatabaseError("Failed to look up account", error),
		});

		if (!account) {
			// Unknown email — ack without processing
			return { success: true as const };
		}

		yield* Gmail.DeltaWorkflow.execute({ accountId: account.id }, { discard: true });

		return { success: true as const };
	});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "webhook", (handlers) =>
		handlers.handle("gmailPush", gmailPush),
	);
}
