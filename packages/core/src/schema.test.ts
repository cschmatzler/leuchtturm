import { Option, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { Email, TrimmedNonEmptyString, Ulid } from "@leuchtturm/core/schema";

describe("core schema primitives", () => {
	it("trims non-empty strings and rejects blank input", () => {
		const valid = Schema.decodeUnknownOption(TrimmedNonEmptyString)("  Ada Lovelace  ");
		const invalid = Schema.decodeUnknownOption(TrimmedNonEmptyString)("  \n\t  ");

		expect(Option.isSome(valid)).toBe(true);
		if (Option.isSome(valid)) {
			expect(valid.value).toBe("Ada Lovelace");
		}
		expect(Option.isNone(invalid)).toBe(true);
	});

	it("normalizes emails and rejects malformed addresses", () => {
		const valid = Schema.decodeUnknownOption(Email)("  Ada.Lovelace@Example.COM  ");
		const invalid = Schema.decodeUnknownOption(Email)("not-an-email");

		expect(Option.isSome(valid)).toBe(true);
		if (Option.isSome(valid)) {
			expect(valid.value).toBe("ada.lovelace@example.com");
		}
		expect(Option.isNone(invalid)).toBe(true);
	});

	it("accepts uppercase ulids and rejects lowercase variants", () => {
		expect(Option.isSome(Schema.decodeUnknownOption(Ulid)("01ARZ3NDEKTSV4RRFFQ69G5FAV"))).toBe(
			true,
		);
		expect(Option.isNone(Schema.decodeUnknownOption(Ulid)("01arz3ndektsv4rrffq69g5fav"))).toBe(
			true,
		);
	});
});
