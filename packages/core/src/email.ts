import { and, eq, gt, inArray } from "drizzle-orm";
import { Effect, Layer, Schema, ServiceMap } from "effect";
import type { CreateEmailResponseSuccess } from "resend";
import { Resend } from "resend";
import { Resource } from "sst";

import { Database } from "@leuchtturm/core/drizzle";
import type { SendParams } from "@leuchtturm/core/email/schema";
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
} from "@leuchtturm/core/mail/mail.sql";
import {
	CreateMailAccountInput,
	CreateMailAccountSecretInput,
	CreateMailOAuthStateInput,
	MailAccountId,
	MailAccountStatus,
	getProviderCapabilities,
	UpdateMailAccountSecretInput,
} from "@leuchtturm/core/mail/schema";

const decodeCreateMailAccountInput = Schema.decodeUnknownSync(CreateMailAccountInput);
const decodeCreateMailAccountSecretInput = Schema.decodeUnknownSync(CreateMailAccountSecretInput);
const decodeCreateMailOAuthStateInput = Schema.decodeUnknownSync(CreateMailOAuthStateInput);
const decodeMailAccountId = Schema.decodeUnknownSync(MailAccountId);
const decodeMailAccountStatus = Schema.decodeUnknownSync(MailAccountStatus);
const decodeUpdateMailAccountSecretInput = Schema.decodeUnknownSync(UpdateMailAccountSecretInput);

export namespace Email {
	export class EmailError extends Schema.TaggedErrorClass<EmailError>()(
		"EmailError",
		{ message: Schema.String },
		{ httpApiStatus: 500 },
	) {}

	export interface Interface {
		readonly send: (params: SendParams) => Effect.Effect<CreateEmailResponseSuccess, EmailError>;
		readonly createAccount: (values: {
			id: string;
			userId: string;
			provider: string;
			email: string;
			displayName: string | null;
			status: string;
		}) => Effect.Effect<void, EmailError>;
		readonly upsertAccount: (values: {
			id: string;
			userId: string;
			provider: string;
			email: string;
			displayName: string | null;
			status: string;
		}) => Effect.Effect<typeof mailAccount.$inferSelect, EmailError>;
		readonly getAccountForUser: (
			accountId: string,
			userId: string,
		) => Effect.Effect<typeof mailAccount.$inferSelect | undefined, EmailError>;
		readonly getAccountByUserAndEmail: (
			userId: string,
			email: string,
		) => Effect.Effect<typeof mailAccount.$inferSelect | undefined, EmailError>;
		readonly getAccountsByEmail: (
			email: string,
		) => Effect.Effect<readonly (typeof mailAccount.$inferSelect)[], EmailError>;
		readonly updateAccountStatus: (
			accountId: string,
			status: string,
		) => Effect.Effect<void, EmailError>;
		readonly createAccountSecret: (values: {
			accountId: string;
			authKind: string;
			encryptedPayload: string;
			encryptedDek: string;
		}) => Effect.Effect<void, EmailError>;
		readonly getAccountSecret: (
			accountId: string,
		) => Effect.Effect<typeof mailAccountSecret.$inferSelect | undefined, EmailError>;
		readonly updateAccountSecret: (
			accountId: string,
			values: {
				encryptedPayload: string;
				encryptedDek: string;
			},
		) => Effect.Effect<void, EmailError>;
		readonly createOAuthState: (values: {
			id: string;
			userId: string;
			sessionId: string;
			expiresAt: Date;
		}) => Effect.Effect<void, EmailError>;
		readonly consumeOAuthState: (values: {
			id: string;
			userId: string;
			sessionId: string;
		}) => Effect.Effect<typeof mailOAuthState.$inferSelect | undefined, EmailError>;
		readonly getAccountByEmail: (
			email: string,
		) => Effect.Effect<typeof mailAccount.$inferSelect | undefined, EmailError>;
		readonly disconnectAccount: (accountId: string) => Effect.Effect<void, EmailError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@leuchtturm/Email") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const { db } = yield* Database.Service;

			yield* Effect.logInfo("Email initialized");

			const fail = (context: string) => (error: unknown) =>
				new EmailError({
					message: `${context}: ${String(error)}`,
				});

			const decode = <A>(context: string, thunk: () => A) =>
				Effect.try({
					try: thunk,
					catch: fail(context),
				});

			const run = <A>(context: string, thunk: () => Promise<A>) =>
				Effect.tryPromise({
					try: thunk,
					catch: fail(context),
				});

			const send = Effect.fn("Email.send")(function* (params: SendParams) {
				const result = yield* Effect.tryPromise({
					try: () => new Resend(Resource.ResendApiKey.value).emails.send(params),
					catch: fail("Resend API request failed"),
				});

				if (result.error || !result.data) {
					return yield* new EmailError({
						message: result.error?.message ?? "Email sent but received no response data",
					});
				}

				return result.data;
			});

			const createAccount = Effect.fn("Email.createAccount")(function* (values: {
				id: string;
				userId: string;
				provider: string;
				email: string;
				displayName: string | null;
				status: string;
			}) {
				const validatedValues = yield* decode("Invalid create mail account input", () =>
					decodeCreateMailAccountInput(values),
				);
				const capabilities = getProviderCapabilities(validatedValues.provider);
				const now = new Date();
				yield* run("Failed to create mail account", () =>
					db.insert(mailAccount).values({
						...validatedValues,
						...capabilities,
						createdAt: now,
						updatedAt: now,
					}),
				);
			});

			const upsertAccount = Effect.fn("Email.upsertAccount")(function* (values: {
				id: string;
				userId: string;
				provider: string;
				email: string;
				displayName: string | null;
				status: string;
			}) {
				const validatedValues = yield* decode("Invalid upsert mail account input", () =>
					decodeCreateMailAccountInput(values),
				);
				const capabilities = getProviderCapabilities(validatedValues.provider);
				const now = new Date();
				const rows = yield* run("Failed to upsert mail account", () =>
					db
						.insert(mailAccount)
						.values({
							...validatedValues,
							...capabilities,
							createdAt: now,
							updatedAt: now,
						})
						.onConflictDoUpdate({
							target: [mailAccount.userId, mailAccount.email],
							set: {
								provider: validatedValues.provider,
								displayName: validatedValues.displayName,
								status: validatedValues.status,
								...capabilities,
								lastErrorCode: null,
								lastErrorMessage: null,
								degradedReason: null,
								updatedAt: now,
							},
						})
						.returning(),
				);
				return rows[0]!;
			});

			const getAccountForUser = Effect.fn("Email.getAccountForUser")(function* (
				accountId: string,
				userId: string,
			) {
				const rows = yield* run("Failed to fetch mail account for user", () =>
					db
						.select()
						.from(mailAccount)
						.where(and(eq(mailAccount.id, accountId), eq(mailAccount.userId, userId)))
						.limit(1),
				);
				return rows[0];
			});

			const getAccountByUserAndEmail = Effect.fn("Email.getAccountByUserAndEmail")(function* (
				userId: string,
				email: string,
			) {
				const rows = yield* run("Failed to fetch mail account by user and email", () =>
					db
						.select()
						.from(mailAccount)
						.where(and(eq(mailAccount.userId, userId), eq(mailAccount.email, email)))
						.limit(1),
				);
				return rows[0];
			});

			const getAccountsByEmail = Effect.fn("Email.getAccountsByEmail")(function* (email: string) {
				return yield* run("Failed to fetch mail accounts by email", () =>
					db.select().from(mailAccount).where(eq(mailAccount.email, email)),
				);
			});

			const updateAccountStatus = Effect.fn("Email.updateAccountStatus")(function* (
				accountId: string,
				status: string,
			) {
				const validatedAccountId = yield* decode("Invalid mail account id", () =>
					decodeMailAccountId(accountId),
				);
				const validatedStatus = yield* decode("Invalid mail account status", () =>
					decodeMailAccountStatus(status),
				);

				yield* run("Failed to update mail account status", () =>
					db
						.update(mailAccount)
						.set({ status: validatedStatus, updatedAt: new Date() })
						.where(eq(mailAccount.id, validatedAccountId)),
				);
			});

			const createAccountSecret = Effect.fn("Email.createAccountSecret")(function* (values: {
				accountId: string;
				authKind: string;
				encryptedPayload: string;
				encryptedDek: string;
			}) {
				const validatedValues = yield* decode("Invalid create mail account secret input", () =>
					decodeCreateMailAccountSecretInput(values),
				);
				const now = new Date();
				yield* run("Failed to create mail account secret", () =>
					db
						.insert(mailAccountSecret)
						.values({
							...validatedValues,
							createdAt: now,
							updatedAt: now,
						})
						.onConflictDoUpdate({
							target: [mailAccountSecret.accountId],
							set: {
								authKind: validatedValues.authKind,
								encryptedPayload: validatedValues.encryptedPayload,
								encryptedDek: validatedValues.encryptedDek,
								updatedAt: now,
							},
						}),
				);
			});

			const getAccountSecret = Effect.fn("Email.getAccountSecret")(function* (accountId: string) {
				const rows = yield* run("Failed to fetch mail account secret", () =>
					db
						.select()
						.from(mailAccountSecret)
						.where(eq(mailAccountSecret.accountId, accountId))
						.limit(1),
				);
				return rows[0];
			});

			const updateAccountSecret = Effect.fn("Email.updateAccountSecret")(function* (
				accountId: string,
				values: {
					encryptedPayload: string;
					encryptedDek: string;
				},
			) {
				const validatedAccountId = yield* decode("Invalid mail account id", () =>
					decodeMailAccountId(accountId),
				);
				const validatedValues = yield* decode("Invalid update mail account secret input", () =>
					decodeUpdateMailAccountSecretInput(values),
				);
				const now = new Date();
				yield* run("Failed to update mail account secret", () =>
					db
						.update(mailAccountSecret)
						.set({
							encryptedPayload: validatedValues.encryptedPayload,
							encryptedDek: validatedValues.encryptedDek,
							updatedAt: now,
						})
						.where(eq(mailAccountSecret.accountId, validatedAccountId)),
				);
			});

			const createOAuthState = Effect.fn("Email.createOAuthState")(function* (values: {
				id: string;
				userId: string;
				sessionId: string;
				expiresAt: Date;
			}) {
				const validatedValues = yield* decode("Invalid create mail OAuth state input", () =>
					decodeCreateMailOAuthStateInput(values),
				);
				yield* run("Failed to create mail OAuth state", () =>
					db.insert(mailOAuthState).values({
						...validatedValues,
						createdAt: new Date(),
					}),
				);
			});

			const consumeOAuthState = Effect.fn("Email.consumeOAuthState")(function* (values: {
				id: string;
				userId: string;
				sessionId: string;
			}) {
				const now = new Date();
				const rows = yield* run("Failed to consume mail OAuth state", () =>
					db
						.delete(mailOAuthState)
						.where(
							and(
								eq(mailOAuthState.id, values.id),
								eq(mailOAuthState.userId, values.userId),
								eq(mailOAuthState.sessionId, values.sessionId),
								gt(mailOAuthState.expiresAt, now),
							),
						)
						.returning(),
				);
				return rows[0];
			});

			const getAccountByEmail = Effect.fn("Email.getAccountByEmail")(function* (email: string) {
				const rows = yield* run("Failed to fetch mail account by email", () =>
					db.select().from(mailAccount).where(eq(mailAccount.email, email)).limit(1),
				);
				return rows[0];
			});

			const disconnectAccount = Effect.fn("Email.disconnectAccount")(function* (accountId: string) {
				const rows = yield* run("Failed to fetch mail account for disconnect", () =>
					db
						.select({ id: mailAccount.id, userId: mailAccount.userId })
						.from(mailAccount)
						.where(eq(mailAccount.id, accountId))
						.limit(1),
				);
				const account = rows[0];

				if (!account) {
					return;
				}

				yield* run("Failed to disconnect mail account", () =>
					db.transaction(async (tx) => {
						const now = new Date();

						await tx
							.update(mailAccount)
							.set({ status: "paused", updatedAt: now })
							.where(eq(mailAccount.id, accountId));

						await tx.delete(mailMessage).where(eq(mailMessage.accountId, accountId));
						await tx.delete(mailConversation).where(eq(mailConversation.accountId, accountId));
						await tx.delete(mailFolder).where(eq(mailFolder.accountId, accountId));
						await tx.delete(mailLabel).where(eq(mailLabel.accountId, accountId));
						await tx.delete(mailIdentity).where(eq(mailIdentity.accountId, accountId));
						await tx.delete(mailAccountSecret).where(eq(mailAccountSecret.accountId, accountId));
						await tx
							.delete(mailAccountSyncState)
							.where(eq(mailAccountSyncState.accountId, accountId));
						await tx
							.delete(mailFolderSyncState)
							.where(eq(mailFolderSyncState.accountId, accountId));
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
							await tx
								.delete(mailParticipant)
								.where(inArray(mailParticipant.id, staleParticipantIds));
						}
					}),
				);
			});

			return Service.of({
				send,
				createAccount,
				upsertAccount,
				getAccountForUser,
				getAccountByUserAndEmail,
				getAccountsByEmail,
				updateAccountStatus,
				createAccountSecret,
				getAccountSecret,
				updateAccountSecret,
				createOAuthState,
				consumeOAuthState,
				getAccountByEmail,
				disconnectAccount,
			});
		}),
	);

	export const defaultLayer = layer;
}
