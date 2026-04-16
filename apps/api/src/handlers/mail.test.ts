import { describe, expect, it } from "vite-plus/test";

import { decodeGmailPushData } from "@leuchtturm/api/handlers/mail";

describe("decodeGmailPushData", () => {
	it("decodes valid push payloads and normalizes the email address", () => {
		const raw = Buffer.from(
			JSON.stringify({ emailAddress: "Test.User+alias@Example.com" }),
			"utf-8",
		).toString("base64");

		expect(decodeGmailPushData(raw)).toEqual({
			emailAddress: "test.user+alias@example.com",
		});
	});

	it("returns undefined for malformed payloads", () => {
		expect(decodeGmailPushData("!!!not-base64!!!")).toBeUndefined();
		expect(
			decodeGmailPushData(Buffer.from(JSON.stringify({ foo: "bar" }), "utf-8").toString("base64")),
		).toBeUndefined();
	});
});
