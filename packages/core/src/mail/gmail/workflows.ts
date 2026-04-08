import { Effect, Layer, Schema } from "effect";
import { Workflow, WorkflowEngine } from "effect/unstable/workflow";
import { Resource } from "sst";

import { Database } from "@leuchtturm/core/drizzle";
import { MailEncryption } from "@leuchtturm/core/mail/encryption";
import { GmailOAuth } from "@leuchtturm/core/mail/gmail/oauth";
import { GmailSync } from "@leuchtturm/core/mail/gmail/sync";
import {
	getMailAccountSecret,
	updateMailAccountSecret,
	updateMailAccountStatus,
} from "@leuchtturm/core/mail/queries";
import { StoredMailOAuthSecret } from "@leuchtturm/core/mail/schema";

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60 * 1000;

function toErrorString(error: unknown): string {
	return String(error);
}

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

const BootstrapWorkflowLayer = Layer.unwrap(
	Effect.sync(() => {
		const topicName = Resource.GmailPubSubTopic.value;

		return BootstrapWorkflow.toLayer(({ accountId, accessToken }) =>
			Effect.gen(function* () {
				const sync = yield* GmailSync.Service;
				const token = accessToken ?? (yield* resolveAccessToken(accountId));
				yield* sync.bootstrapAccount(accountId, token, topicName);
			}).pipe(Effect.mapError(toErrorString)),
		);
	}),
);

const DeltaWorkflowLayer = Layer.unwrap(
	Effect.sync(() => {
		const topicName = Resource.GmailPubSubTopic.value;

		return DeltaWorkflow.toLayer(({ accountId }) =>
			Effect.gen(function* () {
				const sync = yield* GmailSync.Service;
				const token = yield* resolveAccessToken(accountId);

				yield* Effect.catch(sync.syncDelta(accountId, token, topicName), (error) =>
					Effect.gen(function* () {
						const gmailError = error as {
							readonly name?: unknown;
							readonly status?: unknown;
						};
						if (gmailError.name !== "GmailApiError" || gmailError.status !== 401) {
							return yield* Effect.fail(error);
						}
						const refreshed = yield* refreshStoredToken(accountId);
						return yield* sync.syncDelta(accountId, refreshed, topicName);
					}),
				);
			}).pipe(Effect.mapError(toErrorString)),
		);
	}),
);

const GmailWorkflowsLayer = Layer.merge(BootstrapWorkflowLayer, DeltaWorkflowLayer);

const GmailWorkflowDependencies = Layer.mergeAll(
	MailEncryption.defaultLayer,
	GmailOAuth.defaultLayer,
	GmailSync.defaultLayer,
	WorkflowEngine.layerMemory,
);

export const Gmail = {
	BootstrapWorkflow,
	BootstrapWorkflowLayer,
	DeltaWorkflow,
	DeltaWorkflowLayer,
	layer: GmailWorkflowsLayer,
	defaultLayer: GmailWorkflowsLayer.pipe(Layer.provideMerge(GmailWorkflowDependencies)),
} as const;

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

function decryptSecret(
	encryption: MailEncryption.Interface,
	secret: { encryptedPayload: string; encryptedDek: string },
) {
	return Effect.gen(function* () {
		const raw = yield* encryption
			.decrypt({
				encryptedPayload: secret.encryptedPayload,
				encryptedDek: secret.encryptedDek,
			})
			.pipe(
				Effect.mapError(
					(error) => new Error(`Failed to decrypt credentials: ${toErrorString(error)}`),
				),
			);

		return yield* Effect.try({
			try: () => Schema.decodeUnknownSync(StoredMailOAuthSecret)(JSON.parse(raw)),
			catch: (error) => new Error(`Failed to decode credentials: ${toErrorString(error)}`),
		});
	});
}

function ensureFreshToken(
	db: Database.Client,
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
	db: Database.Client,
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
			oauth
				.refreshAccessToken(secret.refreshToken!)
				.pipe(
					Effect.mapError((error) => new Error(`Token refresh failed: ${toErrorString(error)}`)),
				),
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

		const encrypted = yield* encryption
			.encrypt(JSON.stringify(nextSecret))
			.pipe(
				Effect.mapError(
					(error) => new Error(`Failed to encrypt credentials: ${toErrorString(error)}`),
				),
			);
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
