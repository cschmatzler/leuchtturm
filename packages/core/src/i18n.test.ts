import { Option, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_LANGUAGE, resolveLanguage, SupportedLanguageSchema } from "@chevrotain/core/i18n";

describe("SupportedLanguageSchema", () => {
	it("accepts supported languages", () => {
		const result = Schema.decodeUnknownOption(SupportedLanguageSchema)("fr");

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toBe("fr");
		}
	});

	it("rejects unsupported languages", () => {
		const result = Schema.decodeUnknownOption(SupportedLanguageSchema)("en-US");

		expect(Option.isNone(result)).toBe(true);
	});
});

describe("resolveLanguage", () => {
	it("falls back for nullish or unsupported values", () => {
		expect(resolveLanguage(null)).toBe(DEFAULT_LANGUAGE);
		expect(resolveLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
		expect(resolveLanguage("xx")).toBe(DEFAULT_LANGUAGE);
	});

	it("returns supported languages unchanged", () => {
		expect(resolveLanguage("sq")).toBe("sq");
	});
});
