import { type } from "arktype";

import { Id } from "@one/core/id";

export const User = type({
	id: Id,
	name: type("string")
		.pipe((s) => s.trim(), type("string > 0"))
		.describe("Name is required"),
	email: type("string.email").pipe((s) => s.trim().toLowerCase()),
	"image?": "string | null",
	"language?": "string | null",
	emailVerified: type("boolean").default(() => false),
	createdAt: "Date",
	updatedAt: "Date",
});

export type User = typeof User.infer;

export const Session = type({
	id: Id,
	token: "string",
	"ipAddress?": "string | null",
	"userAgent?": "string | null",
	expiresAt: "Date",
	userId: Id,
	createdAt: "Date",
	updatedAt: "Date",
});

export type Session = typeof Session.infer;

export const Account = type({
	id: Id,
	accountId: "string",
	providerId: "string",
	userId: Id,
	"accessToken?": "string | null",
	"refreshToken?": "string | null",
	"idToken?": "string | null",
	"accessTokenExpiresAt?": "Date | null",
	"refreshTokenExpiresAt?": "Date | null",
	"scope?": "string | null",
	"password?": "string > 12 | null",
	createdAt: "Date",
	updatedAt: "Date",
});

export type Account = typeof Account.infer;

export const Verification = type({
	id: Id,
	identifier: "string",
	value: "string",
	expiresAt: "Date",
	createdAt: "Date",
	updatedAt: "Date",
});

export type Verification = typeof Verification.infer;

export const JWKS = type({
	id: Id,
	publicKey: "string",
	privateKey: "string",
	createdAt: "Date",
});

export type JWKS = typeof JWKS.infer;
