import { Option, Schema } from "effect";
import { ulid } from "ulid";
import { describe, expect, it } from "vite-plus/test";

import {
	OrganizationId,
	OrganizationSlug,
	PASSWORD_MIN_LENGTH,
	Password,
	SessionId,
	User,
	UserId,
} from "@leuchtturm/core/auth/schema";

const now = new Date();

describe("auth schema", () => {
	it("normalizes user records and defaults email verification to false", () => {
		const result = Schema.decodeUnknownOption(User)({
			id: `usr_${ulid()}`,
			name: "  Ada Lovelace  ",
			email: "  Ada.Lovelace@Example.COM  ",
			createdAt: now,
			updatedAt: now,
		});

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value.name).toBe("Ada Lovelace");
			expect(result.value.email).toBe("ada.lovelace@example.com");
			expect(result.value.emailVerified).toBe(false);
		}
	});

	it("normalizes organization slugs", () => {
		const result = Schema.decodeUnknownOption(OrganizationSlug)("  Acme-Co  ");

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toBe("acme-co");
		}
	});

	it("enforces the minimum password length", () => {
		expect(
			Option.isNone(Schema.decodeUnknownOption(Password)("x".repeat(PASSWORD_MIN_LENGTH - 1))),
		).toBe(true);
		expect(
			Option.isSome(Schema.decodeUnknownOption(Password)("x".repeat(PASSWORD_MIN_LENGTH))),
		).toBe(true);
	});

	it("rejects auth ids with the wrong prefixes", () => {
		expect(Option.isNone(Schema.decodeUnknownOption(UserId)(`ses_${ulid()}`))).toBe(true);
		expect(Option.isNone(Schema.decodeUnknownOption(SessionId)(`usr_${ulid()}`))).toBe(true);
		expect(Option.isNone(Schema.decodeUnknownOption(OrganizationId)(`usr_${ulid()}`))).toBe(true);
	});
});
