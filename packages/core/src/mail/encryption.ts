import { Effect, Layer, ServiceMap } from "effect";
import { Resource } from "sst";

import { MailEncryptionError } from "@leuchtturm/core/mail/errors";

const ALGORITHM = "AES-GCM" as const;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const DEK_LENGTH = 32;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}

	return String(error);
}

export function parseMailKek(raw: string): Buffer {
	const normalized = raw.trim();

	if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
		return Buffer.from(normalized, "hex");
	}

	const utf8 = Buffer.from(normalized, "utf-8");
	if (utf8.length === 32) {
		return utf8;
	}

	if (normalized.length % 4 === 0 && BASE64_PATTERN.test(normalized)) {
		const decoded = Buffer.from(normalized, "base64");
		if (decoded.length === 32 && decoded.toString("base64") === normalized) {
			return decoded;
		}
	}

	throw new Error(
		"MAIL_KEK must be a 64-character hex string, a base64-encoded 32-byte key, or a 32-byte raw string",
	);
}

type CryptoUsage = "encrypt" | "decrypt";

function randomBytes(length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	globalThis.crypto.getRandomValues(bytes);
	return bytes;
}

async function importKey(key: Buffer, usage: CryptoUsage): Promise<CryptoKey> {
	return await globalThis.crypto.subtle.importKey(
		"raw",
		new Uint8Array(key),
		{ name: ALGORITHM },
		false,
		[usage],
	);
}

async function encryptRaw(key: Buffer, plaintext: Buffer): Promise<string> {
	const nonce = randomBytes(NONCE_LENGTH);
	const encrypted = await globalThis.crypto.subtle.encrypt(
		{ name: ALGORITHM, iv: Buffer.from(nonce), tagLength: TAG_LENGTH * 8 },
		await importKey(key, "encrypt"),
		new Uint8Array(plaintext),
	);
	return Buffer.concat([Buffer.from(nonce), Buffer.from(encrypted)]).toString("base64");
}

async function decryptRaw(key: Buffer, encoded: string): Promise<Buffer> {
	const data = Buffer.from(encoded, "base64");
	const nonce = data.subarray(0, NONCE_LENGTH);
	const ciphertextWithTag = data.subarray(NONCE_LENGTH);
	const decrypted = await globalThis.crypto.subtle.decrypt(
		{ name: ALGORITHM, iv: Buffer.from(nonce), tagLength: TAG_LENGTH * 8 },
		await importKey(key, "decrypt"),
		new Uint8Array(ciphertextWithTag),
	);
	return Buffer.from(decrypted);
}

export interface EncryptedSecret {
	readonly encryptedDek: string;
	readonly encryptedPayload: string;
}

async function envelopeEncrypt(kek: Buffer, payload: string): Promise<EncryptedSecret> {
	const dek = Buffer.from(randomBytes(DEK_LENGTH));
	const encryptedPayload = await encryptRaw(dek, Buffer.from(payload, "utf-8"));
	const encryptedDek = await encryptRaw(kek, dek);
	return { encryptedDek, encryptedPayload };
}

async function envelopeDecrypt(kek: Buffer, encrypted: EncryptedSecret): Promise<string> {
	const dek = await decryptRaw(kek, encrypted.encryptedDek);
	const payload = await decryptRaw(dek, encrypted.encryptedPayload);
	return payload.toString("utf-8");
}

export namespace MailEncryption {
	export interface Interface {
		readonly encrypt: (payload: string) => Effect.Effect<EncryptedSecret, MailEncryptionError>;
		readonly decrypt: (encrypted: EncryptedSecret) => Effect.Effect<string, MailEncryptionError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()(
		"@leuchtturm/MailEncryption",
	) {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const kek = yield* Effect.try({
				try: () => parseMailKek(Resource.MailKek.value),
				catch: (error) =>
					new MailEncryptionError({
						message: toErrorMessage(error),
					}),
			});

			const encrypt = Effect.fn("MailEncryption.encrypt")(function* (payload: string) {
				return yield* Effect.tryPromise({
					try: () => envelopeEncrypt(kek, payload),
					catch: (error) =>
						new MailEncryptionError({
							message: toErrorMessage(error),
						}),
				});
			});

			const decrypt = Effect.fn("MailEncryption.decrypt")(function* (encrypted: EncryptedSecret) {
				return yield* Effect.tryPromise({
					try: () => envelopeDecrypt(kek, encrypted),
					catch: (error) =>
						new MailEncryptionError({
							message: toErrorMessage(error),
						}),
				});
			});

			return Service.of({
				encrypt,
				decrypt,
			});
		}),
	);

	export const defaultLayer = layer;
}
