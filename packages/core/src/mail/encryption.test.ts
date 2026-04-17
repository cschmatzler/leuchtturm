import { describe, expect, it } from "vite-plus/test";

import { parseMailKek } from "@leuchtturm/core/mail/encryption";

describe("parseMailKek", () => {
	it("accepts 64-character hex keys", () => {
		const raw = "a".repeat(64);
		const parsed = parseMailKek(raw);

		expect(parsed).toEqual(Buffer.from(raw, "hex"));
	});

	it("accepts 32-byte raw strings", () => {
		const raw = "12345678901234567890123456789012";
		const parsed = parseMailKek(raw);

		expect(parsed).toEqual(Buffer.from(raw, "utf-8"));
	});

	it("accepts base64-encoded 32-byte keys", () => {
		const source = Buffer.from("12345678901234567890123456789012", "utf-8");
		const parsed = parseMailKek(source.toString("base64"));

		expect(parsed).toEqual(source);
	});

	it("rejects keys in unsupported formats", () => {
		expect(() => parseMailKek("definitely-not-a-valid-kek")).toThrow(
			"MAIL_KEK must be a 64-character hex string, a base64-encoded 32-byte key, or a 32-byte raw string",
		);
	});
});
