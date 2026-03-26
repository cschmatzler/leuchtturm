import { describe, expect, it } from "vite-plus/test";

import { sanitizeEmailHtml } from "@chevrotain/web/lib/sanitize-html";

describe("sanitizeEmailHtml", () => {
	it("preserves safe inline styles needed for email rendering", () => {
		const html =
			'<div style="color:#222;background-color:#fff;font-family:Arial, sans-serif;font-size:14px;line-height:1.4;text-align:center;padding:16px;border:1px solid #ddd"><span style="font-weight:700;text-decoration:underline">Hello</span></div>';

		const sanitized = sanitizeEmailHtml(html);

		expect(sanitized).toContain("color:#222");
		expect(sanitized).toContain("background-color:#fff");
		expect(sanitized).toContain("font-family:Arial, sans-serif");
		expect(sanitized).toContain("font-weight:700");
		expect(sanitized).toContain("text-decoration:underline");
	});

	it("strips script tags", () => {
		const html = '<div>Hello</div><script>alert("xss")</script>';
		const sanitized = sanitizeEmailHtml(html);

		expect(sanitized).not.toContain("<script");
		expect(sanitized).not.toContain("alert");
		expect(sanitized).toContain("Hello");
	});

	it("strips event handler attributes", () => {
		const html = '<div onclick="alert(1)">Click</div>';
		const sanitized = sanitizeEmailHtml(html);

		expect(sanitized).not.toContain("onclick");
		expect(sanitized).toContain("Click");
	});

	it("strips javascript: URIs from links", () => {
		const html = '<a href="javascript:alert(1)">Link</a>';
		const sanitized = sanitizeEmailHtml(html);

		expect(sanitized).not.toContain("javascript:");
	});

	it("allows mailto: and https: URIs", () => {
		const html =
			'<a href="https://example.com">Web</a> <a href="mailto:test@example.com">Email</a>';
		const sanitized = sanitizeEmailHtml(html);

		expect(sanitized).toContain('href="https://example.com"');
		expect(sanitized).toContain('href="mailto:test@example.com"');
	});

	it("allows data: URIs on images", () => {
		const html = '<img src="data:image/png;base64,abc123" alt="test" />';
		const sanitized = sanitizeEmailHtml(html);

		expect(sanitized).toContain("data:image/png;base64,abc123");
	});

	// NOTE: ALLOWED_TAGS and FORBID_TAGS filtering requires a real browser DOM.
	// Happy-dom doesn't implement the DOM APIs DOMPurify needs for tag filtering.
	// In a real browser, only the tags in ALLOWED_TAGS are kept and FORBID_TAGS
	// are always removed. The XSS tests above verify the critical security
	// guarantees that work in all environments.

	it("preserves table structure for email layouts", () => {
		const html =
			'<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
		const sanitized = sanitizeEmailHtml(html);

		expect(sanitized).toContain("<table");
		expect(sanitized).toContain("<thead>");
		expect(sanitized).toContain("<tbody>");
		expect(sanitized).toContain("<th>Header</th>");
		expect(sanitized).toContain("<td>Cell</td>");
	});

	it("strips data-* attributes", () => {
		const html = '<div data-tracking="abc123">Content</div>';
		const sanitized = sanitizeEmailHtml(html);

		expect(sanitized).not.toContain("data-tracking");
		expect(sanitized).toContain("Content");
	});
});
