import * as Effect from "effect/Effect";
import { describe, expect, it, vi } from "vite-plus/test";

import { sendMagicLinkEmail } from "@leuchtturm/email/templates/magic-link";

describe("sendMagicLinkEmail", () => {
	it("passes the rendered magic link email to the provider", async () => {
		const send = vi.fn(() => Effect.succeed({ id: "email_123" }));

		await Effect.runPromise(
			sendMagicLinkEmail({
				signInUrl: "https://api.leuchtturm.dev/auth/magic-link/verify?token=abc",
				email: "user@example.com",
				from: "Leuchtturm <no-reply@mail.leuchtturm.dev>",
				send,
				subject: "Sign in to Leuchtturm",
			}),
		);

		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({
			from: "Leuchtturm <no-reply@mail.leuchtturm.dev>",
			to: "user@example.com",
			subject: "Sign in to Leuchtturm",
			html: expect.stringContaining("Sign in to Leuchtturm"),
			text: expect.stringContaining("https://api.leuchtturm.dev/auth/magic-link/verify?token=abc"),
		});
	});

	it("rethrows provider errors unchanged", async () => {
		const error = new Error("rate limited");
		const send = vi.fn(() => Effect.fail(error));

		await expect(
			Effect.runPromise(
				sendMagicLinkEmail({
					signInUrl: "https://api.leuchtturm.dev/auth/magic-link/verify?token=abc",
					email: "user@example.com",
					from: "Leuchtturm <no-reply@mail.leuchtturm.dev>",
					send,
					subject: "Sign in to Leuchtturm",
				}),
			),
		).rejects.toBe(error);
	});
});
