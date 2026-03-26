/**
 * Mail database query/mutation functions.
 *
 * All direct Drizzle access lives here so that apps/api never imports drizzle-orm.
 */

import { and, eq } from "drizzle-orm";

import type { DatabaseClient } from "@chevrotain/core/drizzle/index";
import {
	mailAccount,
	mailAccountSecret,
	mailConversation,
	mailFolder,
	mailLabel,
	mailMessage,
	mailProviderState,
	mailSyncCursor,
} from "@chevrotain/core/mail/mail.sql";

// ---------------------------------------------------------------------------
// mail_account
// ---------------------------------------------------------------------------

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
	const now = new Date();
	await db.insert(mailAccount).values({
		...values,
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

// ---------------------------------------------------------------------------
// mail_account_secret
// ---------------------------------------------------------------------------

export async function createMailAccountSecret(
	db: DatabaseClient,
	values: {
		accountId: string;
		authKind: string;
		encryptedPayload: string;
		encryptedDek: string;
	},
): Promise<void> {
	const now = new Date();
	await db.insert(mailAccountSecret).values({
		...values,
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

// ---------------------------------------------------------------------------
// Account disconnection (§25.11)
// ---------------------------------------------------------------------------

export async function disconnectMailAccount(db: DatabaseClient, accountId: string): Promise<void> {
	// Set status to paused immediately
	await db.update(mailAccount).set({ status: "paused" }).where(eq(mailAccount.id, accountId));

	// Hard-delete in dependency order.
	// Messages cascade to body_part, message_label, message_mailbox, attachment
	// via FK ON DELETE CASCADE, so deleting messages cleans those up.
	await db.delete(mailMessage).where(eq(mailMessage.accountId, accountId));
	await db.delete(mailConversation).where(eq(mailConversation.accountId, accountId));
	await db.delete(mailFolder).where(eq(mailFolder.accountId, accountId));
	await db.delete(mailLabel).where(eq(mailLabel.accountId, accountId));

	// Backend-only data
	await db.delete(mailAccountSecret).where(eq(mailAccountSecret.accountId, accountId));
	await db.delete(mailSyncCursor).where(eq(mailSyncCursor.accountId, accountId));
	await db.delete(mailProviderState).where(eq(mailProviderState.accountId, accountId));

	// Finally, the account itself
	await db.delete(mailAccount).where(eq(mailAccount.id, accountId));
}
