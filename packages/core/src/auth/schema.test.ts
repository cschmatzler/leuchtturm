import { Option, Schema } from "effect";
import { ulid } from "ulid";
import { describe, expect, it } from "vite-plus/test";

import {
	AccountId,
	Session,
	SessionId,
	User,
	UserId,
	VerificationId,
} from "@chevrotain/core/auth/schema";

const authId = (prefix: string) => `${prefix}_${ulid()}`;

const authIdSchemas = [
	{ name: "UserId", schema: UserId, prefix: "usr", wrongPrefix: "ses" },
	{ name: "SessionId", schema: SessionId, prefix: "ses", wrongPrefix: "usr" },
	{ name: "AccountId", schema: AccountId, prefix: "acc", wrongPrefix: "usr" },
	{ name: "VerificationId", schema: VerificationId, prefix: "ver", wrongPrefix: "usr" },
] as const;

describe("auth ID schemas", () => {
	for (const { name, schema, prefix, wrongPrefix } of authIdSchemas) {
		it(`${name} accepts a valid prefixed ULID`, () => {
			const id = authId(prefix);
			const result = Schema.decodeUnknownOption(schema)(id);

			expect(Option.isSome(result)).toBe(true);
			if (Option.isSome(result)) {
				expect(result.value).toBe(id);
			}
		});

		it(`${name} rejects another auth prefix`, () => {
			const result = Schema.decodeUnknownOption(schema)(authId(wrongPrefix));

			expect(Option.isNone(result)).toBe(true);
		});
	}
});

describe("User schema", () => {
	it("normalizes input and defaults email verification", () => {
		const now = new Date();
		const result = Schema.decodeUnknownOption(User)({
			id: authId("usr"),
			name: "  Ada Lovelace  ",
			email: "ADA@Example.com",
			createdAt: now,
			updatedAt: now,
		});

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value.name).toBe("Ada Lovelace");
			expect(result.value.email).toBe("ada@example.com");
			expect(result.value.emailVerified).toBe(false);
		}
	});

	it("rejects whitespace-only names", () => {
		const now = new Date();
		const result = Schema.decodeUnknownOption(User)({
			id: authId("usr"),
			name: "   ",
			email: "person@example.com",
			emailVerified: true,
			createdAt: now,
			updatedAt: now,
		});

		expect(Option.isNone(result)).toBe(true);
	});
});

describe("Session schema", () => {
	it("rejects swapped user and session ID prefixes", () => {
		const now = new Date();
		const result = Schema.decodeUnknownOption(Session)({
			id: authId("usr"),
			userId: authId("ses"),
			token: "token",
			expiresAt: now,
			createdAt: now,
			updatedAt: now,
		});

		expect(Option.isNone(result)).toBe(true);
	});
});
