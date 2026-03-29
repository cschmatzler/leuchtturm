/**
 * All Drizzle access centralized here so apps/api never imports drizzle-orm directly.
 */

import { and, eq, gt } from "drizzle-orm";
import { Schema } from "effect";

import type { DatabaseClient } from "@chevrotain/core/drizzle/index";
import {
	mailAccount,
	mailAccountSecret,
	mailAccountSyncState,
	mailConversation,
	mailFolder,
	mailFolderSyncState,
	mailIdentity,
	mailLabel,
	mailMessage,
	mailOAuthState,
	mailProviderState,
} from "@chevrotain/core/mail/mail.sql";
import {
	CreateMailAccountInput,
	CreateMailAccountSecretInput,
	CreateMailOAuthStateInput,
	MailAccountId,
	MailAccountStatus,
	UpdateMailAccountSecretInput,
} from "@chevrotain/core/mail/schema";

const decodeCreateMailAccountInput = Schema.decodeUnknownSync(CreateMailAccountInput);
const decodeCreateMailAccountSecretInput = Schema.decodeUnknownSync(CreateMailAccountSecretInput);
const decodeCreateMailOAuthStateInput = Schema.decodeUnknownSync(CreateMailOAuthStateInput);
const decodeMailAccountId = Schema.decodeUnknownSync(MailAccountId);
const decodeMailAccountStatus = Schema.decodeUnknownSync(MailAccountStatus);
const decodeUpdateMailAccountSecretInput = Schema.decodeUnknownSync(UpdateMailAccountSecretInput);

export async function createMailAccount(
	db: DatabaseClient,
	values: {
		id: string;
		userId: string;
		provider: string;
		email: string;
		displayName: string | null;
		status: string;
		supportsThreads: boolean;
		supportsLabels: boolean;
		supportsPushSync: boolean;
		supportsOauth: boolean;
		supportsServerSearch: boolean;
	},
): Promise<void> {
	const validatedValues = decodeCreateMailAccountInput(values);
	const now = new Date();
	await db.insert(mailAccount).values({
		...validatedValues,
		createdAt: now,
		updatedAt: now,
	});
}

export async function getMailAccountForUser(
	db: DatabaseClient,
	accountId: string,
	userId: string,
): Promise<typeof mailAccount.$inferSelect | undefined> {
	const [row] = await db
		.select()
		.from(mailAccount)
		.where(and(eq(mailAccount.id, accountId), eq(mailAccount.userId, userId)))
		.limit(1);
	return row;
}

export async function updateMailAccountStatus(
	db: DatabaseClient,
	accountId: string,
	status: string,
): Promise<void> {
	const validatedAccountId = decodeMailAccountId(accountId);
	const validatedStatus = decodeMailAccountStatus(status);
	await db
		.update(mailAccount)
		.set({ status: validatedStatus, updatedAt: new Date() })
		.where(eq(mailAccount.id, validatedAccountId));
}

export async function createMailAccountSecret(
	db: DatabaseClient,
	values: {
		accountId: string;
		authKind: string;
		encryptedPayload: string;
		encryptedDek: string;
	},
): Promise<void> {
	const validatedValues = decodeCreateMailAccountSecretInput(values);
	const now = new Date();
	await db.insert(mailAccountSecret).values({
		...validatedValues,
		createdAt: now,
		updatedAt: now,
	});
}

export async function getMailAccountSecret(
	db: DatabaseClient,
	accountId: string,
): Promise<typeof mailAccountSecret.$inferSelect | undefined> {
	const [row] = await db
		.select()
		.from(mailAccountSecret)
		.where(eq(mailAccountSecret.accountId, accountId))
		.limit(1);
	return row;
}

export async function updateMailAccountSecret(
	db: DatabaseClient,
	accountId: string,
	values: {
		encryptedPayload: string;
		encryptedDek: string;
	},
): Promise<void> {
	const validatedAccountId = decodeMailAccountId(accountId);
	const validatedValues = decodeUpdateMailAccountSecretInput(values);
	const now = new Date();
	await db
		.update(mailAccountSecret)
		.set({
			encryptedPayload: validatedValues.encryptedPayload,
			encryptedDek: validatedValues.encryptedDek,
			updatedAt: now,
		})
		.where(eq(mailAccountSecret.accountId, validatedAccountId));
}

export async function createMailOAuthState(
	db: DatabaseClient,
	values: {
		id: string;
		userId: string;
		sessionId: string;
		expiresAt: Date;
	},
): Promise<void> {
	const validatedValues = decodeCreateMailOAuthStateInput(values);
	await db.insert(mailOAuthState).values({
		...validatedValues,
		createdAt: new Date(),
	});
}

export async function consumeMailOAuthState(
	db: DatabaseClient,
	values: {
		id: string;
		userId: string;
		sessionId: string;
	},
): Promise<typeof mailOAuthState.$inferSelect | undefined> {
	const now = new Date();
	const [row] = await db
		.delete(mailOAuthState)
		.where(
			and(
				eq(mailOAuthState.id, values.id),
				eq(mailOAuthState.userId, values.userId),
				eq(mailOAuthState.sessionId, values.sessionId),
				gt(mailOAuthState.expiresAt, now),
			),
		)
		.returning();
	return row;
}

export async function disconnectMailAccount(db: DatabaseClient, accountId: string): Promise<void> {
	await db.update(mailAccount).set({ status: "paused" }).where(eq(mailAccount.id, accountId));

	await db.delete(mailMessage).where(eq(mailMessage.accountId, accountId));
	await db.delete(mailConversation).where(eq(mailConversation.accountId, accountId));
	await db.delete(mailFolder).where(eq(mailFolder.accountId, accountId));
	await db.delete(mailLabel).where(eq(mailLabel.accountId, accountId));
	await db.delete(mailIdentity).where(eq(mailIdentity.accountId, accountId));
	await db.delete(mailAccountSecret).where(eq(mailAccountSecret.accountId, accountId));
	await db.delete(mailAccountSyncState).where(eq(mailAccountSyncState.accountId, accountId));
	await db.delete(mailFolderSyncState).where(eq(mailFolderSyncState.accountId, accountId));
	await db.delete(mailProviderState).where(eq(mailProviderState.accountId, accountId));
	await db.delete(mailAccount).where(eq(mailAccount.id, accountId));
}
