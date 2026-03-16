import { type } from "arktype";
import { ulid } from "ulid";
import { describe, expect, it } from "vite-plus/test";

import { createId, Id, PREFIXES } from "@one/core/id";

describe("createId", () => {
	it("returns the expected prefix and a ULID", () => {
		const id = createId("user");

		expect(id.startsWith(`${PREFIXES.user}_`)).toBe(true);

		const [prefix, value] = id.split("_");
		expect(prefix).toBe(PREFIXES.user);
		expect(value).toMatch(/^[0-9A-Z]{26}$/);
	});
});

describe("Id", () => {
	it("accepts a valid prefixed ULID", () => {
		const id = ulid();
		const result = Id(`${PREFIXES.user}_${id}`);

		expect(result instanceof type.errors).toBe(false);
		if (!(result instanceof type.errors)) {
			expect(result).toBe(`${PREFIXES.user}_${id}`);
		}
	});

	it("rejects values with an unknown prefix", () => {
		const result = Id(`bad_${ulid()}`);

		expect(result instanceof type.errors).toBe(true);
		if (result instanceof type.errors) {
			expect(result.summary).toContain("a valid ID format");
		}
	});

	it("rejects values that do not contain a valid ULID", () => {
		const result = Id(`${PREFIXES.user}_not-a-ulid`);

		expect(result instanceof type.errors).toBe(true);
		if (result instanceof type.errors) {
			expect(result.summary).toContain("a valid ID format");
		}
	});

	it("rejects values missing the expected separator", () => {
		const result = Id(`${PREFIXES.user}${ulid()}`);

		expect(result instanceof type.errors).toBe(true);
		if (result instanceof type.errors) {
			expect(result.summary).toContain("a valid ID format");
		}
	});
});
