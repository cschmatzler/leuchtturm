/**
 * Gmail durable workflows.
 *
 * BootstrapWorkflow — triggered once after OAuth callback. Imports 30 days
 * of mail and registers a Pub/Sub watch so Gmail pushes future changes.
 *
 * DeltaWorkflow — triggered by Pub/Sub push notifications. Applies the
 * history delta since the last cursor and renews the watch if expiring.
 *
 * Both workflows resolve access tokens from the encrypted secret store
 * and refresh them when expired.
 */

import { Config, Effect, Layer, Schema } from "effect";
import { Workflow } from "effect/unstable/workflow";

import type { DatabaseClient } from "@chevrotain/core/drizzle/index";
import { Database } from "@chevrotain/core/drizzle/index";
import { MailEncryption } from "@chevrotain/core/mail/encryption";
import { GmailOAuth } from "@chevrotain/core/mail/gmail/oauth";
import { bootstrapGmailAccount, syncGmailDelta } from "@chevrotain/core/mail/gmail/sync";
import {
	getMailAccountSecret,
	updateMailAccountSecret,
	updateMailAccountStatus,
} from "@chevrotain/core/mail/queries";
import { StoredMailOAuthSecret } from "@chevrotain/core/mail/schema";

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60 * 1000;

function toErrorString(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Workflow definitions
// ---------------------------------------------------------------------------

const BootstrapWorkflow = Workflow.make({
	name: "GmailBootstrap",
	payload: {
		accountId: Schema.String,
		accessToken: Schema.optional(Schema.String),
	},
	idempotencyKey: ({ accountId }) => `gmail-bootstrap-${accountId}`,
	error: Schema.String,
});

const DeltaWorkflow = Workflow.make({
	name: "GmailDelta",
	payload: {
		accountId: Schema.String,
	},
	idempotencyKey: ({ accountId }) => `gmail-delta-${accountId}`,
	error: Schema.String,
});

// ---------------------------------------------------------------------------
// Workflow layers — config resolved at construction time
// ---------------------------------------------------------------------------

const BootstrapWorkflowLive = Layer.unwrap(
	Effect.gen(function* () {
		const topicName = yield* Config.string("GMAIL_PUBSUB_TOPIC");

		return BootstrapWorkflow.toLayer(({ accountId, accessToken }) =>
			Effect.gen(function* () {
				const token = accessToken ?? (yield* resolveAccessToken(accountId));
				yield* bootstrapGmailAccount(accountId, token, topicName);
			}).pipe(Effect.mapError(toErrorString)),
		);
	}),
);

const DeltaWorkflowLive = Layer.unwrap(
	Effect.gen(function* () {
		const topicName = yield* Config.string("GMAIL_PUBSUB_TOPIC");

		return DeltaWorkflow.toLayer(({ accountId }) =>
			Effect.gen(function* () {
				const token = yield* resolveAccessToken(accountId);

				yield* Effect.catch(syncGmailDelta(accountId, token, topicName), (error) =>
					Effect.gen(function* () {
						if (!(error instanceof Error && error.message.includes("Gmail API error 401:"))) {
							return yield* Effect.fail(error);
						}
						const refreshed = yield* refreshStoredToken(accountId);
						return yield* syncGmailDelta(accountId, refreshed, topicName);
					}),
				);
			}).pipe(Effect.mapError(toErrorString)),
		);
	}),
);

export const Gmail = {
	BootstrapWorkflow,
	BootstrapWorkflowLive,
	DeltaWorkflow,
	DeltaWorkflowLive,
} as const;

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

function resolveAccessToken(accountId: string) {
	return Effect.gen(function* () {
		const { db } = yield* Database.Service;
		const encryption = yield* MailEncryption.Service;
		const oauth = yield* GmailOAuth.Service;

		const secret = yield* Effect.tryPromise({
			try: () => getMailAccountSecret(db, accountId),
			catch: (error) => new Error(`Failed to fetch credentials: ${toErrorString(error)}`),
		});

		if (!secret) {
			return yield* Effect.fail(new Error("Account credentials not found"));
		}

		const decrypted = yield* decryptSecret(encryption, secret);
		const fresh = yield* ensureFreshToken(db, oauth, encryption, accountId, decrypted);
		return fresh.accessToken;
	});
}

function refreshStoredToken(accountId: string) {
	return Effect.gen(function* () {
		const { db } = yield* Database.Service;
		const encryption = yield* MailEncryption.Service;
		const oauth = yield* GmailOAuth.Service;

		const secret = yield* Effect.tryPromise({
			try: () => getMailAccountSecret(db, accountId),
			catch: (error) => new Error(`Failed to fetch credentials: ${toErrorString(error)}`),
		});

		if (!secret) {
			return yield* Effect.fail(new Error("Account credentials not found"));
		}

		const decrypted = yield* decryptSecret(encryption, secret);
		const refreshed = yield* refreshAccessToken(db, oauth, encryption, accountId, decrypted);
		return refreshed.accessToken;
	});
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function decryptSecret(
	encryption: MailEncryption.Interface,
	secret: { encryptedPayload: string; encryptedDek: string },
) {
	return Effect.try({
		try: () => {
			const raw = encryption.decrypt({
				encryptedPayload: secret.encryptedPayload,
				encryptedDek: secret.encryptedDek,
			});
			return Schema.decodeUnknownSync(StoredMailOAuthSecret)(JSON.parse(raw));
		},
		catch: (error) => new Error(`Failed to decode credentials: ${toErrorString(error)}`),
	});
}

function ensureFreshToken(
	db: DatabaseClient,
	oauth: GmailOAuth.Interface,
	encryption: MailEncryption.Interface,
	accountId: string,
	secret: StoredMailOAuthSecret,
) {
	if (secret.expiresAt > Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS) {
		return Effect.succeed(secret);
	}
	return refreshAccessToken(db, oauth, encryption, accountId, secret);
}

function refreshAccessToken(
	db: DatabaseClient,
	oauth: GmailOAuth.Interface,
	encryption: MailEncryption.Interface,
	accountId: string,
	secret: StoredMailOAuthSecret,
) {
	return Effect.gen(function* () {
		if (!secret.refreshToken) {
			yield* Effect.tryPromise({
				try: () => updateMailAccountStatus(db, accountId, "requires_reauth"),
				catch: (e) => new Error(`Status update failed: ${toErrorString(e)}`),
			});
			return yield* Effect.fail(new Error(`Account ${accountId} requires reauthorization`));
		}

		const refreshed = yield* Effect.catch(
			Effect.tryPromise({
				try: () => oauth.refreshAccessToken(secret.refreshToken!),
				catch: (error) => new Error(`Token refresh failed: ${toErrorString(error)}`),
			}),
			(error) =>
				Effect.gen(function* () {
					yield* Effect.tryPromise({
						try: () => updateMailAccountStatus(db, accountId, "requires_reauth"),
						catch: () => error,
					});
					return yield* Effect.fail(error);
				}),
		);

		const nextSecret: StoredMailOAuthSecret = {
			accessToken: refreshed.accessToken,
			refreshToken: refreshed.refreshToken ?? secret.refreshToken,
			expiresAt: Date.now() + refreshed.expiresIn * 1000,
		};

		const encrypted = encryption.encrypt(JSON.stringify(nextSecret));
		yield* Effect.tryPromise({
			try: () => updateMailAccountSecret(db, accountId, encrypted),
			catch: (error) => new Error(`Failed to persist token: ${toErrorString(error)}`),
		});

		yield* Effect.tryPromise({
			try: () => updateMailAccountStatus(db, accountId, "healthy"),
			catch: (error) => new Error(`Status update failed: ${toErrorString(error)}`),
		});

		return nextSecret;
	});
}
