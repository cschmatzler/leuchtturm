import { Effect, Schema } from "effect";

import { Email, TrimmedNonEmptyString, Ulid } from "@leuchtturm/core/schema";

export const PASSWORD_MIN_LENGTH = 13;
export const PASSWORD_VALIDATION_MESSAGE = "Password must be more than 12 characters";

export const Password = Schema.String.check(Schema.isMinLength(PASSWORD_MIN_LENGTH)).annotate({
	description: PASSWORD_VALIDATION_MESSAGE,
});

export const UserId = Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId"));

export type UserId = typeof UserId.Type;

export const User = Schema.Struct({
	id: UserId,
	name: TrimmedNonEmptyString.annotate({ description: "Name is required" }),
	email: Email,
	image: Schema.optional(Schema.NullOr(Schema.String)),
	language: Schema.optional(Schema.NullOr(Schema.String)),
	emailVerified: Schema.Boolean.pipe(
		Schema.optional,
		Schema.withDecodingDefault(Effect.succeed(false)),
	),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export type User = typeof User.Type;

export const SessionId = Schema.TemplateLiteral(["ses_", Ulid]).pipe(Schema.brand("SessionId"));

export type SessionId = typeof SessionId.Type;

export const Session = Schema.Struct({
	id: SessionId,
	token: Schema.String,
	ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
	userAgent: Schema.optional(Schema.NullOr(Schema.String)),
	expiresAt: Schema.Date,
	userId: UserId,
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export type Session = typeof Session.Type;

export const AccountId = Schema.TemplateLiteral(["acc_", Ulid]).pipe(Schema.brand("AccountId"));

export type AccountId = typeof AccountId.Type;

export const Account = Schema.Struct({
	id: AccountId,
	accountId: Schema.String,
	providerId: Schema.String,
	userId: UserId,
	accessToken: Schema.optional(Schema.NullOr(Schema.String)),
	refreshToken: Schema.optional(Schema.NullOr(Schema.String)),
	idToken: Schema.optional(Schema.NullOr(Schema.String)),
	accessTokenExpiresAt: Schema.optional(Schema.NullOr(Schema.Date)),
	refreshTokenExpiresAt: Schema.optional(Schema.NullOr(Schema.Date)),
	scope: Schema.optional(Schema.NullOr(Schema.String)),
	password: Schema.optional(Schema.NullOr(Password)),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export type Account = typeof Account.Type;

export const VerificationId = Schema.TemplateLiteral(["ver_", Ulid]).pipe(
	Schema.brand("VerificationId"),
);

export type VerificationId = typeof VerificationId.Type;

export const Verification = Schema.Struct({
	id: VerificationId,
	identifier: Schema.String,
	value: Schema.String,
	expiresAt: Schema.Date,
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export type Verification = typeof Verification.Type;

export const SessionData = Schema.Struct({
	user: User,
	session: Session,
});

export type SessionData = typeof SessionData.Type;
