/**
 * Mail API handlers.
 *
 * Handles Gmail OAuth2 connection flow, sync triggers, and account disconnection.
 */

import { Effect, Schema } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { Database } from "@chevrotain/core/drizzle/index";
import { DatabaseError, ValidationError } from "@chevrotain/core/errors";
import { MailEncryption } from "@chevrotain/core/mail/encryption";
import { GmailOAuth } from "@chevrotain/core/mail/gmail/oauth";
import { bootstrapGmailAccount, incrementalGmailSync } from "@chevrotain/core/mail/gmail/sync";
import {
	consumeMailOAuthState,
	createMailAccount,
	createMailAccountSecret,
	createMailOAuthState,
	disconnectMailAccount,
	getMailAccountForUser,
	getMailAccountSecret,
	updateMailAccountSecret,
	updateMailAccountStatus,
} from "@chevrotain/core/mail/queries";
import {
	createMailAccountId,
	createMailOAuthStateId,
	GMAIL_CAPABILITIES,
} from "@chevrotain/core/mail/schema";

const StoredMailOAuthSecret = Schema.Struct({
	accessToken: Schema.String,
	refreshToken: Schema.optional(Schema.String),
	expiresAt: Schema.Number,
});

type StoredMailOAuthSecret = typeof StoredMailOAuthSecret.Type;

const MAIL_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_REFRESH_SKEW_MS = 60 * 1000;

function toDatabaseError(context: string, error: unknown) {
	return new DatabaseError({
		message: `${context}: ${error instanceof Error ? error.message : String(error)}`,
	});
}

function encryptMailOAuthSecret(
	encryption: MailEncryption.Interface,
	secret: StoredMailOAuthSecret,
) {
	return encryption.encrypt(JSON.stringify(secret));
}

function decodeMailOAuthSecret(
	encryption: MailEncryption.Interface,
	secret: {
		encryptedPayload: string;
		encryptedDek: string;
	},
) {
	return Effect.try({
		try: () => {
			const decrypted = encryption.decrypt({
				encryptedPayload: secret.encryptedPayload,
				encryptedDek: secret.encryptedDek,
			});
			return Schema.decodeUnknownSync(StoredMailOAuthSecret)(JSON.parse(decrypted));
		},
		catch: (error) => toDatabaseError("Failed to decode stored mail credentials", error),
	});
}

function persistMailOAuthSecret(
	db: Database.Interface["db"],
	accountId: string,
	encryption: MailEncryption.Interface,
	secret: StoredMailOAuthSecret,
) {
	const encrypted = encryptMailOAuthSecret(encryption, secret);
	return Effect.tryPromise({
		try: () =>
			updateMailAccountSecret(db, accountId, {
				encryptedPayload: encrypted.encryptedPayload,
				encryptedDek: encrypted.encryptedDek,
			}),
		catch: (error) => toDatabaseError("Failed to persist mail credentials", error),
	});
}

function setMailAccountStatus(db: Database.Interface["db"], accountId: string, status: string) {
	return Effect.tryPromise({
		try: () => updateMailAccountStatus(db, accountId, status),
		catch: (error) => toDatabaseError(`Failed to set account status to ${status}`, error),
	});
}

function refreshMailAccessToken(
	db: Database.Interface["db"],
	oauth: GmailOAuth.Interface,
	encryption: MailEncryption.Interface,
	accountId: string,
	secret: StoredMailOAuthSecret,
) {
	return Effect.gen(function* () {
		if (!secret.refreshToken) {
			yield* setMailAccountStatus(db, accountId, "requires_reauth");
			return yield* Effect.fail(
				new DatabaseError({ message: `Mail account ${accountId} requires reauthorization` }),
			);
		}

		const refreshedTokens = yield* Effect.catch(
			Effect.tryPromise({
				try: () => oauth.refreshAccessToken(secret.refreshToken!),
				catch: (error) => toDatabaseError("Failed to refresh Gmail access token", error),
			}),
			(error) =>
				Effect.gen(function* () {
					yield* setMailAccountStatus(db, accountId, "requires_reauth");
					return yield* Effect.fail(error);
				}),
		);

		const nextSecret: StoredMailOAuthSecret = {
			accessToken: refreshedTokens.accessToken,
			refreshToken: refreshedTokens.refreshToken ?? secret.refreshToken,
			expiresAt: Date.now() + refreshedTokens.expiresIn * 1000,
		};

		yield* persistMailOAuthSecret(db, accountId, encryption, nextSecret);
		yield* setMailAccountStatus(db, accountId, "healthy");
		return nextSecret;
	});
}

function ensureFreshMailAccessToken(
	db: Database.Interface["db"],
	oauth: GmailOAuth.Interface,
	encryption: MailEncryption.Interface,
	accountId: string,
	secret: StoredMailOAuthSecret,
) {
	if (secret.expiresAt > Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS) {
		return Effect.succeed(secret);
	}

	return refreshMailAccessToken(db, oauth, encryption, accountId, secret);
}

function isGmailUnauthorizedError(error: unknown) {
	return error instanceof Error && error.message.includes("Gmail API error 401:");
}

function forkLoggedBackgroundTask<R, E>(effect: Effect.Effect<void, E, R>, message: string) {
	return effect.pipe(
		Effect.tapError((error) => Effect.logError(`${message}: ${String(error)}`)),
		Effect.ignore,
		Effect.forkDetach,
	);
}

function runIncrementalSyncWithRefresh(
	db: Database.Interface["db"],
	oauth: GmailOAuth.Interface,
	encryption: MailEncryption.Interface,
	accountId: string,
	secret: StoredMailOAuthSecret,
) {
	return Effect.gen(function* () {
		const freshSecret = yield* ensureFreshMailAccessToken(db, oauth, encryption, accountId, secret);

		yield* Effect.catch(incrementalGmailSync(accountId, freshSecret.accessToken), (error) =>
			Effect.gen(function* () {
				if (!isGmailUnauthorizedError(error)) {
					return yield* Effect.fail(error);
				}

				const refreshedSecret = yield* refreshMailAccessToken(
					db,
					oauth,
					encryption,
					accountId,
					freshSecret,
				);
				return yield* incrementalGmailSync(accountId, refreshedSecret.accessToken);
			}),
		);
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

				const encrypted = encryptMailOAuthSecret(encryption, {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					expiresAt: Date.now() + tokens.expiresIn * 1000,
				});

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

				yield* forkLoggedBackgroundTask(
					bootstrapGmailAccount(accountId, tokens.accessToken),
					`Bootstrap failed for ${accountId}`,
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
				const oauth = yield* GmailOAuth.Service;

				const account = yield* Effect.tryPromise({
					try: () => getMailAccountForUser(db, payload.accountId, user.id),
					catch: (error) => toDatabaseError("Failed to fetch account", error),
				});

				if (!account) {
					return yield* Effect.fail(new DatabaseError({ message: "Account not found" }));
				}

				const secret = yield* Effect.tryPromise({
					try: () => getMailAccountSecret(db, payload.accountId),
					catch: (error) => toDatabaseError("Failed to fetch mail credentials", error),
				});

				if (!secret) {
					return yield* Effect.fail(
						new DatabaseError({ message: "Account credentials not found" }),
					);
				}

				const decryptedSecret = yield* decodeMailOAuthSecret(encryption, secret);
				yield* forkLoggedBackgroundTask(
					runIncrementalSyncWithRefresh(db, oauth, encryption, payload.accountId, decryptedSecret),
					`Sync failed for ${payload.accountId}`,
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
