import { describe, expect, it, vi } from "vite-plus/test";

import { sendInvitationEmail } from "@leuchtturm/email/invitation";

describe("sendInvitationEmail", () => {
	it("passes the rendered invitation email to the provider", async () => {
		const send = vi.fn().mockResolvedValue({ id: "email_123" });

		await sendInvitationEmail({
			acceptUrl: "https://leuchtturm.dev/accept-invitation?id=inv_123",
			email: "user@example.com",
			from: "Leuchtturm <no-reply@leuchtturm.dev>",
			inviterName: "Chris",
			organizationName: "Sopa",
			send,
			subject: "Invitation to Leuchtturm",
		});

		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({
			from: "Leuchtturm <no-reply@leuchtturm.dev>",
			to: "user@example.com",
			subject: "Invitation to Leuchtturm",
			html: expect.stringContaining("Join Sopa"),
			text: expect.stringContaining("https://leuchtturm.dev/accept-invitation?id=inv_123"),
		});
	});

	it("rethrows provider errors unchanged", async () => {
		const error = new Error("rate limited");
		const send = vi.fn().mockRejectedValue(error);

		await expect(
			sendInvitationEmail({
				acceptUrl: "https://leuchtturm.dev/accept-invitation?id=inv_123",
				email: "user@example.com",
				from: "Leuchtturm <no-reply@leuchtturm.dev>",
				inviterName: "Chris",
				organizationName: "Sopa",
				send,
				subject: "Invitation to Leuchtturm",
			}),
		).rejects.toBe(error);
	});
});
