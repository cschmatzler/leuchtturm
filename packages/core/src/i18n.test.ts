import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_LANGUAGE, resolveLanguage } from "@chevrotain/core/i18n";

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
