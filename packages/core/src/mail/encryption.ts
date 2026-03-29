/**
 * Envelope encryption for mail account secrets (§11.2, §36).
 * Each row gets a random DEK that encrypts the payload; the DEK itself is encrypted with a KEK from env.
 * Format: base64(nonce[12] + ciphertext + authTag[16])
 * Algorithm: AES-256-GCM
 */

import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm" as const;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const DEK_LENGTH = 32;

function parseMailKek(raw: string): Buffer {
	if (/^[0-9a-fA-F]{64}$/.test(raw)) {
		return Buffer.from(raw, "hex");
	}

	const utf8 = Buffer.from(raw, "utf-8");
	if (utf8.length === 32) {
		return utf8;
	}

	throw new Error("MAIL_KEK must be either a 64-character hex string or a 32-byte raw string");
}

function encryptRaw(key: Buffer, plaintext: Buffer): string {
	const nonce = randomBytes(NONCE_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, nonce);
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([nonce, ciphertext, tag]).toString("base64");
}

function decryptRaw(key: Buffer, encoded: string): Buffer {
	const data = Buffer.from(encoded, "base64");
	const nonce = data.subarray(0, NONCE_LENGTH);
	const tag = data.subarray(data.length - TAG_LENGTH);
	const ciphertext = data.subarray(NONCE_LENGTH, data.length - TAG_LENGTH);
	const decipher = createDecipheriv(ALGORITHM, key, nonce);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export interface EncryptedSecret {
	readonly encryptedDek: string;
	readonly encryptedPayload: string;
}

function envelopeEncrypt(kek: Buffer, payload: string): EncryptedSecret {
	const dek = randomBytes(DEK_LENGTH);
	const encryptedPayload = encryptRaw(dek, Buffer.from(payload, "utf-8"));
	const encryptedDek = encryptRaw(kek, dek);
	return { encryptedDek, encryptedPayload };
}

function envelopeDecrypt(kek: Buffer, encrypted: EncryptedSecret): string {
	const dek = decryptRaw(kek, encrypted.encryptedDek);
	const payload = decryptRaw(dek, encrypted.encryptedPayload);
	return payload.toString("utf-8");
}

export namespace MailEncryption {
	export interface Interface {
		readonly encrypt: (payload: string) => EncryptedSecret;
		readonly decrypt: (encrypted: EncryptedSecret) => string;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()(
		"@chevrotain/MailEncryption",
	) {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const kekHex = yield* Config.redacted("MAIL_KEK");
			const kek = yield* Effect.try({
				try: () => parseMailKek(Redacted.value(kekHex)),
				catch: (error) => (error instanceof Error ? error : new Error(String(error))),
			});

			return Service.of({
				encrypt: (payload) => envelopeEncrypt(kek, payload),
				decrypt: (encrypted) => envelopeDecrypt(kek, encrypted),
			});
		}),
	);

	export const defaultLayer = layer;
}
