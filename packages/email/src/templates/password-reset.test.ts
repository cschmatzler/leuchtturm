import { Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";

import { sendPasswordResetEmail } from "@leuchtturm/email/templates/password-reset";

describe("sendPasswordResetEmail", () => {
	it("passes the rendered password reset email to the provider", async () => {
		const send = vi.fn(() => Effect.succeed({ id: "email_123" }));

		await Effect.runPromise(
			sendPasswordResetEmail({
				email: "user@example.com",
				from: "Leuchtturm <no-reply@leuchtturm.dev>",
				resetUrl: "https://leuchtturm.dev/reset?token=abc123",
				send,
				subject: "Reset your password",
				userName: "Chris",
			}),
		);

		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({
			from: "Leuchtturm <no-reply@leuchtturm.dev>",
			to: "user@example.com",
			subject: "Reset your password",
			html: expect.stringContaining("Reset your password"),
			text: expect.stringContaining("https://leuchtturm.dev/reset?token=abc123"),
		});
	});

	it("rethrows provider errors unchanged", async () => {
		const error = new Error("rate limited");
		const send = vi.fn(() => Effect.fail(error));

		await expect(
			Effect.runPromise(
				sendPasswordResetEmail({
					email: "user@example.com",
					from: "Leuchtturm <no-reply@leuchtturm.dev>",
					resetUrl: "https://leuchtturm.dev/reset?token=abc123",
					send,
					subject: "Reset your password",
					userName: "Chris",
				}),
			),
		).rejects.toBe(error);
	});
});
