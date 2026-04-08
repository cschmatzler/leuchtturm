import { describe, expect, it } from "vite-plus/test";

import {
	buildMessageParticipantViews,
	buildMailParticipantInputs,
	buildMailSearchDocumentValues,
	collectConversationParticipants,
	createProviderPayloadDigest,
} from "@leuchtturm/core/mail/ingest";
import type { ProviderMessage } from "@leuchtturm/core/mail/provider";

const providerMessage: ProviderMessage = {
	providerRef: "msg_123",
	subject: "Quarterly update",
	snippet: "Latest numbers attached",
	sender: { name: "Ada Lovelace", address: "ADA@example.com" },
	toRecipients: [{ address: "team@example.com" }],
	ccRecipients: [{ name: "Grace Hopper", address: "grace@example.com" }],
	bccRecipients: [{ address: "audit@example.com" }],
	isUnread: true,
	isStarred: false,
	isDraft: false,
	headers: {
		replyTo: [{ address: "reply@example.com" }],
	},
	bodyParts: [
		{ contentType: "text/plain", content: "Hello world" },
		{ contentType: "text/html", content: "<p>Hello <strong>world</strong></p>" },
	],
	attachments: [],
};

describe("mail ingest helpers", () => {
	it("extracts normalized participants for every mail role", () => {
		expect(buildMailParticipantInputs(providerMessage)).toEqual([
			{
				displayName: "Ada Lovelace",
				normalizedAddress: "ada@example.com",
				ordinal: 0,
				role: "from",
			},
			{
				displayName: null,
				normalizedAddress: "team@example.com",
				ordinal: 0,
				role: "to",
			},
			{
				displayName: "Grace Hopper",
				normalizedAddress: "grace@example.com",
				ordinal: 0,
				role: "cc",
			},
			{
				displayName: null,
				normalizedAddress: "audit@example.com",
				ordinal: 0,
				role: "bcc",
			},
			{
				displayName: null,
				normalizedAddress: "reply@example.com",
				ordinal: 0,
				role: "reply_to",
			},
		]);
	});

	it("skips blank participant addresses while keeping per-role ordinals", () => {
		expect(
			buildMailParticipantInputs({
				...providerMessage,
				sender: { name: " Ada Lovelace ", address: " ADA@example.com " },
				toRecipients: [{ address: "   " }, { name: " Team ", address: " TEAM@example.com " }],
				ccRecipients: [{ address: "   " }, { address: "cc@example.com" }],
				bccRecipients: [],
				headers: {
					replyTo: [{ address: "   " }, { address: "reply@example.com" }],
				},
			}),
		).toEqual([
			{
				displayName: "Ada Lovelace",
				normalizedAddress: "ada@example.com",
				ordinal: 0,
				role: "from",
			},
			{
				displayName: "Team",
				normalizedAddress: "team@example.com",
				ordinal: 1,
				role: "to",
			},
			{
				displayName: null,
				normalizedAddress: "cc@example.com",
				ordinal: 1,
				role: "cc",
			},
			{
				displayName: null,
				normalizedAddress: "reply@example.com",
				ordinal: 1,
				role: "reply_to",
			},
		]);
	});

	it("collects unique conversation participants from senders and visible recipients", () => {
		expect(
			collectConversationParticipants([
				providerMessage,
				{
					...providerMessage,
					providerRef: "msg_456",
					sender: { address: "team@example.com" },
					toRecipients: [{ address: "ada@example.com" }],
					ccRecipients: [],
					bccRecipients: [],
				},
			]),
		).toEqual([
			{ address: "ada@example.com", name: "Ada Lovelace" },
			{ address: "team@example.com", name: undefined },
			{ address: "grace@example.com", name: "Grace Hopper" },
		]);
	});

	it("builds search document text from normalized message content", () => {
		expect(buildMailSearchDocumentValues(providerMessage)).toEqual({
			bodyText: "Hello world Hello world",
			mirroredCoverageKind: "full_thread",
			recipientText: "team@example.com Grace Hopper <grace@example.com> audit@example.com",
			senderText: "Ada Lovelace <ada@example.com>",
			snippetText: "Latest numbers attached",
			subjectText: "Quarterly update",
		});
	});

	it("strips non-searchable html content and collapses normalized search fields", () => {
		expect(
			buildMailSearchDocumentValues({
				bodyParts: [
					{
						contentType: "text/html",
						content:
							"<style>.hidden { display: none; }</style><script>ignore()</script><p>&nbsp;Hello &amp; <strong>world</strong></p>",
					},
					{ contentType: "text/plain", content: "  \n\t  " },
				],
				sender: { name: " Ada Lovelace ", address: " ADA@example.com " },
				toRecipients: [],
				ccRecipients: [],
				bccRecipients: [],
				snippet: "  Latest\n numbers attached  ",
				subject: "  Quarterly\n update  ",
			}),
		).toEqual({
			bodyText: "Hello & world",
			mirroredCoverageKind: "full_thread",
			recipientText: null,
			senderText: "Ada Lovelace <ada@example.com>",
			snippetText: "Latest numbers attached",
			subjectText: "Quarterly update",
		});
	});

	it("hashes provider payloads deterministically", () => {
		const digestA = createProviderPayloadDigest({ id: "msg_123", value: 1 });
		const digestB = createProviderPayloadDigest({ id: "msg_123", value: 1 });

		expect(digestA.json).toBe('{"id":"msg_123","value":1}');
		expect(digestA.byteSize).toBeGreaterThan(0);
		expect(digestA.contentSha256).toBe(digestB.contentSha256);
	});

	it("reconstructs structured addresses from persisted participant rows", () => {
		expect(
			buildMessageParticipantViews([
				{
					displayName: null,
					normalizedAddress: "second@example.com",
					ordinal: 1,
					role: "to",
				},
				{
					displayName: "Ada Lovelace",
					normalizedAddress: "ada@example.com",
					ordinal: 0,
					role: "from",
				},
				{
					displayName: null,
					normalizedAddress: "first@example.com",
					ordinal: 0,
					role: "to",
				},
				{
					displayName: "Grace Hopper",
					normalizedAddress: "grace@example.com",
					ordinal: 0,
					role: "cc",
				},
				{
					displayName: null,
					normalizedAddress: "audit@example.com",
					ordinal: 0,
					role: "bcc",
				},
				{
					displayName: null,
					normalizedAddress: "reply@example.com",
					ordinal: 0,
					role: "reply_to",
				},
			]),
		).toEqual({
			bccRecipients: [{ address: "audit@example.com" }],
			ccRecipients: [{ address: "grace@example.com", name: "Grace Hopper" }],
			replyTo: [{ address: "reply@example.com" }],
			sender: { address: "ada@example.com", name: "Ada Lovelace" },
			toRecipients: [{ address: "first@example.com" }, { address: "second@example.com" }],
		});
	});
});
