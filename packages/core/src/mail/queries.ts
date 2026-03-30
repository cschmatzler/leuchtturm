/**
 * All Drizzle access centralized here so apps/api never imports drizzle-orm directly.
 */

import { and, eq, gt, inArray } from "drizzle-orm";
import { Schema } from "effect";

import type { DatabaseExecutor } from "@chevrotain/core/drizzle/index";
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
	mailMessageParticipant,
	mailOAuthState,
	mailParticipant,
	mailProviderState,
} from "@chevrotain/core/mail/mail.sql";
import {
	CreateMailAccountInput,
	CreateMailAccountSecretInput,
	CreateMailOAuthStateInput,
	MailAccountId,
	MailAccountStatus,
	getProviderCapabilities,
	UpdateMailAccountSecretInput,
} from "@chevrotain/core/mail/schema";

const decodeCreateMailAccountInput = Schema.decodeUnknownSync(CreateMailAccountInput);
const decodeCreateMailAccountSecretInput = Schema.decodeUnknownSync(CreateMailAccountSecretInput);
const decodeCreateMailOAuthStateInput = Schema.decodeUnknownSync(CreateMailOAuthStateInput);
const decodeMailAccountId = Schema.decodeUnknownSync(MailAccountId);
const decodeMailAccountStatus = Schema.decodeUnknownSync(MailAccountStatus);
const decodeUpdateMailAccountSecretInput = Schema.decodeUnknownSync(UpdateMailAccountSecretInput);

export async function createMailAccount(
	db: DatabaseExecutor,
	values: {
		id: string;
		userId: string;
		provider: string;
		email: string;
		displayName: string | null;
		status: string;
	},
): Promise<void> {
	const validatedValues = decodeCreateMailAccountInput(values);
	const capabilities = getProviderCapabilities(validatedValues.provider);
	const now = new Date();
	await db.insert(mailAccount).values({
		...validatedValues,
		...capabilities,
		createdAt: now,
		updatedAt: now,
	});
}

export async function getMailAccountForUser(
	db: DatabaseExecutor,
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
	db: DatabaseExecutor,
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
	db: DatabaseExecutor,
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
	db: DatabaseExecutor,
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
	db: DatabaseExecutor,
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
	db: DatabaseExecutor,
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
	db: DatabaseExecutor,
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

export async function getMailAccountByEmail(
	db: DatabaseExecutor,
	email: string,
): Promise<typeof mailAccount.$inferSelect | undefined> {
	const [row] = await db.select().from(mailAccount).where(eq(mailAccount.email, email)).limit(1);
	return row;
}

export async function disconnectMailAccount(
	db: DatabaseExecutor,
	accountId: string,
): Promise<void> {
	const [account] = await db
		.select({ id: mailAccount.id, userId: mailAccount.userId })
		.from(mailAccount)
		.where(eq(mailAccount.id, accountId))
		.limit(1);

	if (!account) {
		return;
	}

	await db.transaction(async (tx) => {
		const now = new Date();

		await tx
			.update(mailAccount)
			.set({ status: "paused", updatedAt: now })
			.where(eq(mailAccount.id, accountId));

		await tx.delete(mailConversation).where(eq(mailConversation.accountId, accountId));
		await tx.delete(mailMessage).where(eq(mailMessage.accountId, accountId));
		await tx.delete(mailFolder).where(eq(mailFolder.accountId, accountId));
		await tx.delete(mailLabel).where(eq(mailLabel.accountId, accountId));
		await tx.delete(mailIdentity).where(eq(mailIdentity.accountId, accountId));
		await tx.delete(mailAccountSecret).where(eq(mailAccountSecret.accountId, accountId));
		await tx.delete(mailAccountSyncState).where(eq(mailAccountSyncState.accountId, accountId));
		await tx.delete(mailFolderSyncState).where(eq(mailFolderSyncState.accountId, accountId));
		await tx.delete(mailProviderState).where(eq(mailProviderState.accountId, accountId));
		await tx.delete(mailAccount).where(eq(mailAccount.id, accountId));

		const remainingParticipantRefs = await tx
			.select({ participantId: mailMessageParticipant.participantId })
			.from(mailMessageParticipant)
			.where(eq(mailMessageParticipant.userId, account.userId));

		const activeParticipantIds = new Set(
			remainingParticipantRefs.map((participantRef) => participantRef.participantId),
		);

		const userParticipants = await tx
			.select({ id: mailParticipant.id })
			.from(mailParticipant)
			.where(eq(mailParticipant.userId, account.userId));

		const staleParticipantIds = userParticipants
			.map((participant) => participant.id)
			.filter((participantId) => !activeParticipantIds.has(participantId));

		if (staleParticipantIds.length > 0) {
			await tx.delete(mailParticipant).where(inArray(mailParticipant.id, staleParticipantIds));
		}
	});
}
