import * as Effect from "effect/Effect";
import { describe, expect, it, vi } from "vitest";

import { sendEmailVerificationEmail } from "@leuchtturm/email/templates/email-verification";

describe("sendEmailVerificationEmail", () => {
	it("passes the rendered email verification email to the provider", async () => {
		const send = vi.fn(() => Effect.succeed({ id: "email_123" }));

		await Effect.runPromise(
			sendEmailVerificationEmail({
				verificationUrl: "https://api.leuchtturm.dev/auth/verify-email?token=token_123",
				email: "user@example.com",
				from: "Leuchtturm <no-reply@mail.leuchtturm.dev>",
				send,
				subject: "Verify your account",
			}),
		);

		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({
			from: "Leuchtturm <no-reply@mail.leuchtturm.dev>",
			to: "user@example.com",
			subject: "Verify your account",
			html: expect.stringContaining("Verify your email address"),
			text: expect.stringContaining("https://api.leuchtturm.dev/auth/verify-email?token=token_123"),
		});
	});

	it("rethrows provider errors unchanged", async () => {
		const error = new Error("rate limited");
		const send = vi.fn(() => Effect.fail(error));

		await expect(
			Effect.runPromise(
				sendEmailVerificationEmail({
					verificationUrl: "https://api.leuchtturm.dev/auth/verify-email?token=token_123",
					email: "user@example.com",
					from: "Leuchtturm <no-reply@mail.leuchtturm.dev>",
					send,
					subject: "Verify your account",
				}),
			),
		).rejects.toBe(error);
	});
});
