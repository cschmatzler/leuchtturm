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
import { Email } from "@leuchtturm/core/email";
import { DatabaseError, NotFoundError, ValidationError } from "@leuchtturm/core/errors";
import { MailEncryption } from "@leuchtturm/core/mail/encryption";
import { GmailOAuth } from "@leuchtturm/core/mail/gmail/oauth";
import { Gmail } from "@leuchtturm/core/mail/gmail/workflows";
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
		const email = yield* Email.Service;
		const oauth = yield* GmailOAuth.Service;
		const state = createMailOAuthStateId();

		yield* email
			.createOAuthState({
				id: state,
				userId: user.id,
				sessionId: session.id,
				expiresAt: new Date(Date.now() + MailHandlers.oauthStateTtlMs),
			})
			.pipe(
				Effect.mapError((error) =>
					MailHandlers.toDatabaseError("Failed to create OAuth state", error),
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
				Effect.mapError((error) =>
					MailHandlers.toDatabaseError("Failed to validate OAuth state", error),
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

		const accountId = createMailAccountId();
		yield* email
			.createAccount({
				id: accountId,
				userId: user.id,
				provider: "gmail",
				email: userInfo.email,
				displayName: userInfo.name ?? null,
				status: "connecting",
			})
			.pipe(
				Effect.mapError((error) =>
					MailHandlers.toDatabaseError("Failed to create mail account", error),
				),
			);

		const encrypted = yield* encryption.encrypt(
			JSON.stringify({
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
				expiresAt: Date.now() + tokens.expiresIn * 1000,
			}),
		);

		yield* email
			.createAccountSecret({
				accountId,
				authKind: "oauth2",
				encryptedPayload: encrypted.encryptedPayload,
				encryptedDek: encrypted.encryptedDek,
			})
			.pipe(
				Effect.mapError((error) =>
					MailHandlers.toDatabaseError("Failed to store mail credentials", error),
				),
			);

		yield* Gmail.BootstrapWorkflow.execute(
			{ accountId, accessToken: tokens.accessToken },
			{ discard: true },
		);

		return { accountId };
	});

	const disconnect = Effect.fn("mail.disconnect")(function* ({ payload }) {
		const { user } = yield* AuthMiddleware.CurrentUser;
		const email = yield* Email.Service;

		const account = yield* email
			.getAccountForUser(payload.accountId, user.id)
			.pipe(
				Effect.mapError((error) => MailHandlers.toDatabaseError("Failed to fetch account", error)),
			);

		if (!account) {
			return yield* Effect.fail(new NotFoundError({ resource: "MailAccount" }));
		}

		yield* email
			.disconnectAccount(payload.accountId)
			.pipe(Effect.mapError((error) => MailHandlers.toDatabaseError("Disconnect failed", error)));

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

		const email = yield* Email.Service;
		const account = yield* email
			.getAccountByEmail(decoded.emailAddress!)
			.pipe(
				Effect.mapError((error) =>
					MailHandlers.toDatabaseError("Failed to look up account", error),
				),
			);

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
