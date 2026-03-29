/**
 * Raw email HTML is stored as-is so sanitization can change without re-syncing.
 * Done at render time with DOMPurify.
 */

import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
	"a",
	"abbr",
	"b",
	"blockquote",
	"br",
	"caption",
	"cite",
	"code",
	"col",
	"colgroup",
	"dd",
	"del",
	"div",
	"dl",
	"dt",
	"em",
	"figcaption",
	"figure",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"i",
	"img",
	"ins",
	"li",
	"mark",
	"ol",
	"p",
	"pre",
	"q",
	"s",
	"section",
	"small",
	"span",
	"strong",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"time",
	"tr",
	"u",
	"ul",
	"wbr",
];

const ALLOWED_ATTRS = [
	"href",
	"src",
	"alt",
	"title",
	"class",
	"style",
	"width",
	"height",
	"dir",
	"lang",
	"colspan",
	"rowspan",
	"scope",
	"align",
	"valign",
	"bgcolor",
	"border",
	"cellpadding",
	"cellspacing",
];

/**
 * Sanitize raw email HTML for safe rendering.
 * Uses DOMPurify with an allowlist of tags, attributes, and URI schemes.
 */

// Additional defence-in-depth: block dangerous elements even if they slip into ALLOWED_TAGS
const FORBID_TAGS = [
	"script",
	"style",
	"iframe",
	"object",
	"embed",
	"form",
	"input",
	"textarea",
	"select",
	"button",
	"link",
	"meta",
	"base",
	"noscript",
	"svg",
	"math",
];

export function sanitizeEmailHtml(html: string): string {
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS,
		ALLOWED_ATTR: ALLOWED_ATTRS,
		FORBID_TAGS,
		ALLOWED_URI_REGEXP: /^(?:https?|mailto|data):/i,
		ALLOW_DATA_ATTR: false,
	});
}
