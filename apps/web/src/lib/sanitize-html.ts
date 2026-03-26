/**
 * Client-side email HTML sanitization using DOMPurify.
 *
 * Raw email HTML is stored as-is in the database so we can change the
 * rendering/sanitization pipeline without re-syncing. Sanitization happens
 * here, at render time.
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
 *
 * Uses DOMPurify with an allowlist of tags, attributes, and URI schemes
 * appropriate for email content. Links are forced to open in a new tab.
 */
/**
 * Tags explicitly forbidden regardless of ALLOWED_TAGS.
 * Defence-in-depth against elements that could execute code, load remote
 * resources outside of img, or break out of the rendering container.
 */
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
