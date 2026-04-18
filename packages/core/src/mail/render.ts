import { Schema } from "effect";

import type { ProviderBodyPart } from "@leuchtturm/core/mail/provider";

export const MAIL_MESSAGE_RENDER_BUNDLE_VERSION = 1 as const;
export const MAIL_CONVERSATION_RENDER_BUNDLE_VERSION = 1 as const;
export const MAIL_RENDER_PARSER_VERSION = "gmail-rest-v1" as const;
export const MAIL_RENDER_SANITIZER_VERSION = "mail-html-sanitize-v1" as const;

const RenderKind = Schema.Literals(["html", "text"]);

export const MessageRenderBundle = Schema.Struct({
	version: Schema.Literal(MAIL_MESSAGE_RENDER_BUNDLE_VERSION),
	messageId: Schema.String,
	preferredKind: RenderKind,
	html: Schema.NullOr(Schema.String),
	text: Schema.NullOr(Schema.String),
	parserVersion: Schema.String,
	sanitizerVersion: Schema.String,
});
export type MessageRenderBundle = typeof MessageRenderBundle.Type;

export const ConversationRenderBundle = Schema.Struct({
	version: Schema.Literal(MAIL_CONVERSATION_RENDER_BUNDLE_VERSION),
	conversationId: Schema.String,
	parserVersion: Schema.String,
	sanitizerVersion: Schema.String,
	messages: Schema.Array(
		Schema.Struct({
			messageId: Schema.String,
			renderKind: RenderKind,
			content: Schema.String,
		}),
	),
});
export type ConversationRenderBundle = typeof ConversationRenderBundle.Type;

export type PreferredRender = {
	readonly content: string;
	readonly renderKind: "html" | "text";
};

const decodeMessageRenderBundleUnknown = Schema.decodeUnknownSync(MessageRenderBundle);
const decodeConversationRenderBundleUnknown = Schema.decodeUnknownSync(ConversationRenderBundle);

const disallowedElementPattern =
	/<(script|style|iframe|object|embed|meta|link|base|form|input|textarea|select|button|svg|math)[\s\S]*?<\/\1\s*>/gi;
const selfClosingDangerousPattern = /<(meta|link|base|input)(?:\s[^>]*?)?>/gi;
const eventHandlerPattern = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const javascriptUriPattern = /\s(href|src)\s*=\s*("|')?\s*javascript:[^"'\s>]*(?:\2)?/gi;

export function sanitizeEmailHtmlServer(html: string): string {
	return html
		.replace(disallowedElementPattern, "")
		.replace(selfClosingDangerousPattern, "")
		.replace(eventHandlerPattern, "")
		.replace(javascriptUriPattern, "");
}

export function buildMessageRenderBundle(options: {
	readonly messageId: string;
	readonly bodyParts: readonly ProviderBodyPart[];
	readonly parserVersion: string;
	readonly sanitizerVersion: string;
}): MessageRenderBundle {
	const firstHtml = options.bodyParts.find((part) => part.contentType === "text/html");
	const firstText = options.bodyParts.find((part) => part.contentType === "text/plain");
	const html = firstHtml ? sanitizeEmailHtmlServer(firstHtml.content) : null;
	const text = firstText?.content ?? null;

	return {
		version: MAIL_MESSAGE_RENDER_BUNDLE_VERSION,
		messageId: options.messageId,
		preferredKind: html ? "html" : "text",
		html,
		text,
		parserVersion: options.parserVersion,
		sanitizerVersion: options.sanitizerVersion,
	};
}

export function getPreferredMessageRender(bundle: MessageRenderBundle): PreferredRender {
	if (bundle.preferredKind === "html" && bundle.html !== null) {
		return { renderKind: "html", content: bundle.html };
	}

	if (bundle.preferredKind === "text" && bundle.text !== null) {
		return { renderKind: "text", content: bundle.text };
	}

	if (bundle.html !== null) {
		return { renderKind: "html", content: bundle.html };
	}

	if (bundle.text !== null) {
		return { renderKind: "text", content: bundle.text };
	}

	return { renderKind: "text", content: "" };
}

export function buildConversationRenderBundle(options: {
	readonly conversationId: string;
	readonly parserVersion: string;
	readonly sanitizerVersion: string;
	readonly messages: ReadonlyArray<{
		readonly messageId: string;
		readonly bundle: MessageRenderBundle;
	}>;
}): ConversationRenderBundle {
	return {
		version: MAIL_CONVERSATION_RENDER_BUNDLE_VERSION,
		conversationId: options.conversationId,
		parserVersion: options.parserVersion,
		sanitizerVersion: options.sanitizerVersion,
		messages: options.messages.map(({ messageId, bundle }) => {
			const preferred = getPreferredMessageRender(bundle);
			return {
				messageId,
				renderKind: preferred.renderKind,
				content: preferred.content,
			};
		}),
	};
}

export function decodeMessageRenderBundle(value: unknown): MessageRenderBundle {
	return decodeMessageRenderBundleUnknown(value);
}

export function decodeConversationRenderBundle(value: unknown): ConversationRenderBundle {
	return decodeConversationRenderBundleUnknown(value);
}
