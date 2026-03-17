import { Option, Schema } from "effect";
import { ulid } from "ulid";
import { describe, expect, it } from "vite-plus/test";

import { createId, Id, PREFIXES } from "@chevrotain/core/id";

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
		const result = Schema.decodeUnknownOption(Id)(`${PREFIXES.user}_${id}`);

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toBe(`${PREFIXES.user}_${id}`);
		}
	});

	it("rejects values with an unknown prefix", () => {
		const result = Schema.decodeUnknownOption(Id)(`bad_${ulid()}`);

		expect(Option.isNone(result)).toBe(true);
	});

	it("rejects values that do not contain a valid ULID", () => {
		const result = Schema.decodeUnknownOption(Id)(`${PREFIXES.user}_not-a-ulid`);

		expect(Option.isNone(result)).toBe(true);
	});

	it("rejects values missing the expected separator", () => {
		const result = Schema.decodeUnknownOption(Id)(`${PREFIXES.user}${ulid()}`);

		expect(Option.isNone(result)).toBe(true);
	});
});
