import { type } from "arktype";
import { describe, expect, it } from "vite-plus/test";

import { User } from "@chevrotain/core/auth/schema";
import { createId } from "@chevrotain/core/id";

describe("User schema", () => {
	it("normalizes input and defaults email verification", () => {
		const now = new Date();
		const result = User({
			id: createId("user"),
			name: "  Ada Lovelace  ",
			email: "ADA@Example.com",
			createdAt: now,
			updatedAt: now,
		});

		expect(result instanceof type.errors).toBe(false);
		if (!(result instanceof type.errors)) {
			expect(result.name).toBe("Ada Lovelace");
			expect(result.email).toBe("ada@example.com");
			expect(result.emailVerified).toBe(false);
		}
	});

	it("rejects whitespace-only names", () => {
		const now = new Date();
		const result = User({
			id: createId("user"),
			name: "   ",
			email: "person@example.com",
			emailVerified: true,
			createdAt: now,
			updatedAt: now,
		});

		expect(result instanceof type.errors).toBe(true);
		if (result instanceof type.errors) {
			expect(result.summary).toContain("non-empty");
		}
	});
});
