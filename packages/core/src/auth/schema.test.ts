import { Option, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { User } from "@chevrotain/core/auth/schema";
import { createId } from "@chevrotain/core/id";

describe("User schema", () => {
	it("normalizes input and defaults email verification", () => {
		const now = new Date();
		const result = Schema.decodeUnknownOption(User)({
			id: createId("user"),
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
			id: createId("user"),
			name: "   ",
			email: "person@example.com",
			emailVerified: true,
			createdAt: now,
			updatedAt: now,
		});

		expect(Option.isNone(result)).toBe(true);
	});
});
