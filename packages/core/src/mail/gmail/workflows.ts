import { Effect, Layer, Schema } from "effect";
import { Resource } from "sst";

import { Email } from "@leuchtturm/core/email";
import { MailEncryption } from "@leuchtturm/core/mail/encryption";
import { GmailAdapter } from "@leuchtturm/core/mail/gmail/adapter";
import { GmailOAuth } from "@leuchtturm/core/mail/gmail/oauth";
import { GmailSync } from "@leuchtturm/core/mail/gmail/sync";
import { StoredMailOAuthSecret } from "@leuchtturm/core/mail/schema";

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60 * 1000;

interface WorkflowExecuteOptions {
	readonly discard?: boolean;
}

function toErrorString(error: unknown): string {
	return String(error);
}

const BootstrapWorkflow = {
	execute: (
		{ accountId, accessToken }: { accountId: string; accessToken?: string },
		_options?: WorkflowExecuteOptions,
	) =>
		Effect.gen(function* () {
			const sync = yield* GmailSync.Service;
			const topicName = Resource.GmailPubSubTopic.value;
			const token = accessToken ?? (yield* resolveAccessToken(accountId));
			yield* sync.bootstrapAccount(accountId, token, topicName);
		}).pipe(Effect.mapError(toErrorString)),
} as const;

const DeltaWorkflow = {
	execute: ({ accountId }: { accountId: string }, _options?: WorkflowExecuteOptions) =>
		Effect.gen(function* () {
			const sync = yield* GmailSync.Service;
			const topicName = Resource.GmailPubSubTopic.value;
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
} as const;

const stopWatch = (accountId: string) =>
	Effect.gen(function* () {
		const token = yield* Effect.catch(resolveAccessToken(accountId), () =>
			Effect.succeed(undefined),
		);
		if (!token) {
			return;
		}

		const adapter = new GmailAdapter(token);
		yield* Effect.catch(adapter.stopWatch(), (error) =>
			Effect.gen(function* () {
				const gmailError = error as {
					readonly name?: unknown;
					readonly status?: unknown;
				};
				if (gmailError.name !== "GmailApiError" || gmailError.status !== 401) {
					return yield* Effect.fail(error);
				}

				const refreshed = yield* refreshStoredToken(accountId);
				const freshAdapter = new GmailAdapter(refreshed);
				yield* freshAdapter.stopWatch();
			}),
		);
	}).pipe(Effect.mapError(toErrorString));

const BootstrapWorkflowLayer = Layer.empty;
const DeltaWorkflowLayer = Layer.empty;
const GmailWorkflowsLayer = Layer.empty;

const GmailWorkflowDependencies = Layer.mergeAll(
	Email.defaultLayer,
	MailEncryption.defaultLayer,
	GmailOAuth.defaultLayer,
	GmailSync.defaultLayer,
);

export const Gmail = {
	BootstrapWorkflow,
	BootstrapWorkflowLayer,
	DeltaWorkflow,
	DeltaWorkflowLayer,
	layer: GmailWorkflowsLayer,
	defaultLayer: GmailWorkflowDependencies,
	stopWatch,
} as const;

function resolveAccessToken(accountId: string) {
	return Effect.gen(function* () {
		const email = yield* Email.Service;
		const encryption = yield* MailEncryption.Service;
		const oauth = yield* GmailOAuth.Service;

		const secret = yield* email
			.getAccountSecret(accountId)
			.pipe(
				Effect.mapError(
					(error) => new Error(`Failed to fetch credentials: ${toErrorString(error)}`),
				),
			);

		if (!secret) {
			return yield* Effect.fail(new Error("Account credentials not found"));
		}

		const decrypted = yield* decryptSecret(encryption, secret);
		const fresh = yield* ensureFreshToken(email, oauth, encryption, accountId, decrypted);
		return fresh.accessToken;
	});
}

function refreshStoredToken(accountId: string) {
	return Effect.gen(function* () {
		const email = yield* Email.Service;
		const encryption = yield* MailEncryption.Service;
		const oauth = yield* GmailOAuth.Service;

		const secret = yield* email
			.getAccountSecret(accountId)
			.pipe(
				Effect.mapError(
					(error) => new Error(`Failed to fetch credentials: ${toErrorString(error)}`),
				),
			);

		if (!secret) {
			return yield* Effect.fail(new Error("Account credentials not found"));
		}

		const decrypted = yield* decryptSecret(encryption, secret);
		const refreshed = yield* refreshAccessToken(email, oauth, encryption, accountId, decrypted);
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
	email: Email.Interface,
	oauth: GmailOAuth.Interface,
	encryption: MailEncryption.Interface,
	accountId: string,
	secret: StoredMailOAuthSecret,
) {
	if (secret.expiresAt > Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS) {
		return Effect.succeed(secret);
	}
	return refreshAccessToken(email, oauth, encryption, accountId, secret);
}

function refreshAccessToken(
	email: Email.Interface,
	oauth: GmailOAuth.Interface,
	encryption: MailEncryption.Interface,
	accountId: string,
	secret: StoredMailOAuthSecret,
) {
	return Effect.gen(function* () {
		if (!secret.refreshToken) {
			yield* email
				.updateAccountStatus(accountId, "requires_reauth")
				.pipe(
					Effect.mapError((error) => new Error(`Status update failed: ${toErrorString(error)}`)),
				);
			return yield* Effect.fail(new Error(`Account ${accountId} requires reauthorization`));
		}

		const refreshed = yield* Effect.catch(
			oauth
				.refreshAccessToken(secret.refreshToken)
				.pipe(
					Effect.mapError((error) => new Error(`Token refresh failed: ${toErrorString(error)}`)),
				),
			(error) =>
				Effect.gen(function* () {
					yield* email
						.updateAccountStatus(accountId, "requires_reauth")
						.pipe(Effect.mapError(() => error));
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
		yield* email
			.updateAccountSecret(accountId, encrypted)
			.pipe(
				Effect.mapError((error) => new Error(`Failed to persist token: ${toErrorString(error)}`)),
			);

		yield* email
			.updateAccountStatus(accountId, "healthy")
			.pipe(Effect.mapError((error) => new Error(`Status update failed: ${toErrorString(error)}`)));

		return nextSecret;
	});
}
