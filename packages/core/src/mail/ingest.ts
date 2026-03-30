import { createHash } from "node:crypto";

import type {
	ProviderBodyPart,
	ProviderEmailAddress,
	ProviderMessage,
} from "@chevrotain/core/mail/provider";
import type { MailMirroredCoverageKind, MailParticipantRole } from "@chevrotain/core/mail/schema";

export interface MailParticipantInput {
	readonly displayName: string | null;
	readonly normalizedAddress: string;
	readonly ordinal: number;
	readonly role: MailParticipantRole;
}

export interface PersistedMessageParticipant {
	readonly displayName: string | null;
	readonly normalizedAddress: string;
	readonly ordinal: number;
	readonly role: MailParticipantRole;
}

export interface MessageParticipantViews {
	readonly bccRecipients: ProviderEmailAddress[];
	readonly ccRecipients: ProviderEmailAddress[];
	readonly replyTo: ProviderEmailAddress[];
	readonly sender: ProviderEmailAddress | null;
	readonly toRecipients: ProviderEmailAddress[];
}

export interface MailSearchDocumentValues {
	readonly bodyText: string | null;
	readonly mirroredCoverageKind: MailMirroredCoverageKind;
	readonly recipientText: string | null;
	readonly senderText: string | null;
	readonly snippetText: string | null;
	readonly subjectText: string | null;
}

export interface SearchDocumentSource {
	readonly bccRecipients?: readonly ProviderEmailAddress[] | null;
	readonly bodyParts: readonly Pick<ProviderBodyPart, "content" | "contentType">[];
	readonly ccRecipients?: readonly ProviderEmailAddress[] | null;
	readonly sender?: ProviderEmailAddress | null;
	readonly snippet?: string | null;
	readonly subject?: string | null;
	readonly toRecipients?: readonly ProviderEmailAddress[] | null;
}

export interface ProviderPayloadDigest {
	readonly byteSize: number;
	readonly contentSha256: string;
	readonly json: string;
}

function collapseWhitespace(value: string): string {
	const collapsed = value.replace(/\s+/g, " ").trim();
	return collapsed.length > 0 ? collapsed : "";
}

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'");
}

function stripHtmlForSearch(value: string): string {
	return collapseWhitespace(
		decodeHtmlEntities(
			value
				.replace(/<style[\s\S]*?<\/style>/gi, " ")
				.replace(/<script[\s\S]*?<\/script>/gi, " ")
				.replace(/<[^>]+>/g, " "),
		),
	);
}

function renderEmailAddress(address: ProviderEmailAddress): string {
	const normalizedAddress = normalizeParticipantAddress(address.address);
	if (address.name && address.name.trim().length > 0) {
		return `${address.name.trim()} <${normalizedAddress}>`;
	}
	return normalizedAddress;
}

function renderEmailAddresses(addresses?: readonly ProviderEmailAddress[] | null): string | null {
	if (!addresses || addresses.length === 0) {
		return null;
	}

	const rendered = addresses
		.map(renderEmailAddress)
		.map(collapseWhitespace)
		.filter((value) => value.length > 0);

	return rendered.length > 0 ? rendered.join(", ") : null;
}

function appendParticipants(
	participants: MailParticipantInput[],
	role: MailParticipantRole,
	addresses: readonly ProviderEmailAddress[],
) {
	for (const [index, address] of addresses.entries()) {
		const normalizedAddress = normalizeParticipantAddress(address.address);
		if (normalizedAddress.length === 0) {
			continue;
		}

		participants.push({
			displayName: address.name?.trim() || null,
			normalizedAddress,
			ordinal: index,
			role,
		});
	}
}

function toProviderEmailAddress(participant: PersistedMessageParticipant): ProviderEmailAddress {
	return {
		address: participant.normalizedAddress,
		...(participant.displayName ? { name: participant.displayName } : {}),
	};
}

export function uniqueConversationAddresses(
	addresses: Array<ProviderEmailAddress | null | undefined>,
): ProviderEmailAddress[] {
	const seen = new Set<string>();
	const unique: ProviderEmailAddress[] = [];

	for (const address of addresses) {
		if (!address) {
			continue;
		}

		const normalizedAddress = normalizeParticipantAddress(address.address);
		if (normalizedAddress.length === 0 || seen.has(normalizedAddress)) {
			continue;
		}

		seen.add(normalizedAddress);
		unique.push({
			address: normalizedAddress,
			name: address.name?.trim() || undefined,
		});
	}

	return unique;
}

export function normalizeParticipantAddress(address: string): string {
	return collapseWhitespace(address).toLowerCase();
}

export function buildMailParticipantInputs(message: ProviderMessage): MailParticipantInput[] {
	const participants: MailParticipantInput[] = [];

	if (message.sender) {
		appendParticipants(participants, "from", [message.sender]);
	}
	appendParticipants(participants, "to", message.toRecipients ?? []);
	appendParticipants(participants, "cc", message.ccRecipients ?? []);
	appendParticipants(participants, "bcc", message.bccRecipients ?? []);
	appendParticipants(participants, "reply_to", message.headers?.replyTo ?? []);

	return participants;
}

export function buildMessageParticipantViews(
	participants: readonly PersistedMessageParticipant[],
): MessageParticipantViews {
	const participantsByRole: Record<MailParticipantRole, PersistedMessageParticipant[]> = {
		from: [],
		to: [],
		cc: [],
		bcc: [],
		reply_to: [],
	};

	for (const participant of participants) {
		participantsByRole[participant.role].push(participant);
	}

	const toOrderedAddresses = (role: MailParticipantRole) =>
		participantsByRole[role]
			.slice()
			.sort((left, right) => left.ordinal - right.ordinal)
			.map(toProviderEmailAddress);

	const senders = toOrderedAddresses("from");

	return {
		bccRecipients: toOrderedAddresses("bcc"),
		ccRecipients: toOrderedAddresses("cc"),
		replyTo: toOrderedAddresses("reply_to"),
		sender: senders[0] ?? null,
		toRecipients: toOrderedAddresses("to"),
	};
}

export function collectConversationParticipants(
	messages: readonly ProviderMessage[],
): ProviderEmailAddress[] {
	return uniqueConversationAddresses(
		messages.flatMap((message) => [
			message.sender,
			...(message.toRecipients ?? []),
			...(message.ccRecipients ?? []),
		]),
	);
}

export function buildMailSearchDocumentValues(
	source: SearchDocumentSource,
): MailSearchDocumentValues {
	const senderText = source.sender ? renderEmailAddress(source.sender) : null;
	const recipientText = [
		renderEmailAddresses(source.toRecipients),
		renderEmailAddresses(source.ccRecipients),
		renderEmailAddresses(source.bccRecipients),
	]
		.filter((value): value is string => value !== null)
		.join(" ");

	const bodyText = source.bodyParts
		.map((bodyPart) =>
			bodyPart.contentType === "text/html"
				? stripHtmlForSearch(bodyPart.content)
				: collapseWhitespace(bodyPart.content),
		)
		.filter((value) => value.length > 0)
		.join(" ");

	return {
		bodyText: bodyText.length > 0 ? bodyText : null,
		mirroredCoverageKind: "full_thread",
		recipientText: recipientText.length > 0 ? recipientText : null,
		senderText,
		snippetText: source.snippet ? collapseWhitespace(source.snippet) : null,
		subjectText: source.subject ? collapseWhitespace(source.subject) : null,
	};
}

export function createProviderPayloadDigest(payload: unknown): ProviderPayloadDigest {
	const json = JSON.stringify(payload);
	const byteSize = new TextEncoder().encode(json).length;
	const contentSha256 = createHash("sha256").update(json).digest("hex");

	return { byteSize, contentSha256, json };
}
