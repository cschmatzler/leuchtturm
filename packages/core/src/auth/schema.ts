import { Schema, SchemaGetter } from "effect";

import { Id } from "@chevrotain/core/id";
import { TrimmedNonEmptyString } from "@chevrotain/core/schema";

const EmailPattern = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));

const TrimmedLowercaseEmail = Schema.String.pipe(
	Schema.decodeTo(EmailPattern, {
		decode: SchemaGetter.transform((s: string) => s.trim().toLowerCase()),
		encode: SchemaGetter.transform((s: string) => s),
	}),
);

export const PASSWORD_MIN_LENGTH = 13;
export const PASSWORD_VALIDATION_MESSAGE = "Password must be more than 12 characters";

export const Password = Schema.String.check(Schema.isMinLength(PASSWORD_MIN_LENGTH)).annotate({
	description: PASSWORD_VALIDATION_MESSAGE,
});

export const User = Schema.Struct({
	id: Id,
	name: TrimmedNonEmptyString.annotate({ description: "Name is required" }),
	email: TrimmedLowercaseEmail,
	image: Schema.optional(Schema.NullOr(Schema.String)),
	language: Schema.optional(Schema.NullOr(Schema.String)),
	emailVerified: Schema.Boolean.pipe(
		Schema.optional,
		Schema.withDecodingDefault(() => false),
	),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export type User = typeof User.Type;

export const Session = Schema.Struct({
	id: Id,
	token: Schema.String,
	ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
	userAgent: Schema.optional(Schema.NullOr(Schema.String)),
	expiresAt: Schema.Date,
	userId: Id,
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export type Session = typeof Session.Type;

export const Account = Schema.Struct({
	id: Id,
	accountId: Schema.String,
	providerId: Schema.String,
	userId: Id,
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

export const Verification = Schema.Struct({
	id: Id,
	identifier: Schema.String,
	value: Schema.String,
	expiresAt: Schema.Date,
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export type Verification = typeof Verification.Type;

export const JWKS = Schema.Struct({
	id: Id,
	publicKey: Schema.String,
	privateKey: Schema.String,
	createdAt: Schema.Date,
});

export type JWKS = typeof JWKS.Type;
