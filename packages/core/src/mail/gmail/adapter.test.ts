import { describe, expect, it } from "vite-plus/test";

import { sanitizeHtml } from "@chevrotain/core/mail/gmail/adapter";

describe("mail html sanitization", () => {
	it("preserves safe inline styles needed for email rendering", () => {
		const html =
			'<div style="color:#222;background-color:#fff;font-family:Arial, sans-serif;font-size:14px;line-height:1.4;text-align:center;padding:16px;border:1px solid #ddd"><span style="font-weight:700;text-decoration:underline">Hello</span></div>';

		const sanitized = sanitizeHtml(html);

		expect(sanitized).toContain(
			'style="color:#222;background-color:#fff;font-family:Arial, sans-serif;font-size:14px;line-height:1.4;text-align:center;padding:16px;border:1px solid #ddd"',
		);
		expect(sanitized).toContain('style="font-weight:700;text-decoration:underline"');
	});

	it("still strips unsafe inline styles", () => {
		const html =
			'<div style="color:#222;background-image:url(javascript:alert(1));position:absolute">Hello</div>';

		const sanitized = sanitizeHtml(html);

		expect(sanitized).toContain('style="color:#222;position:absolute"');
		expect(sanitized).not.toContain("background-image");
		expect(sanitized).not.toContain("javascript:");
	});
});
