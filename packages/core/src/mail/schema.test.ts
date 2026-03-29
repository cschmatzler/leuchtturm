import { Option, Schema } from "effect";
import { ulid } from "ulid";
import { describe, expect, it } from "vite-plus/test";

import { ProviderMessage } from "@chevrotain/core/mail/provider";
import { CreateMailAccountInput, MailAccountStatus } from "@chevrotain/core/mail/schema";

const now = new Date();

describe("mail persisted write schemas", () => {
	it("accepts a valid mail account insert payload", () => {
		const result = Schema.decodeUnknownOption(CreateMailAccountInput)({
			id: `mac_${ulid()}`,
			userId: `usr_${ulid()}`,
			provider: "gmail",
			email: "Mail@Example.com",
			displayName: null,
			status: "connecting",
		});

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value.email).toBe("mail@example.com");
		}
	});

	it("rejects an invalid mail account status", () => {
		const result = Schema.decodeUnknownOption(MailAccountStatus)("broken");

		expect(Option.isNone(result)).toBe(true);
	});
});

describe("provider message schema", () => {
	it("rejects unsupported body part content types before persistence", () => {
		const result = Schema.decodeUnknownOption(ProviderMessage)({
			providerRef: "msg_123",
			subject: "Subject",
			isUnread: true,
			isStarred: false,
			isDraft: false,
			bodyParts: [{ contentType: "application/pdf", content: "body" }],
			attachments: [],
			receivedAt: now,
		});

		expect(Option.isNone(result)).toBe(true);
	});
});
