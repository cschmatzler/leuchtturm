/**
 * Envelope encryption for mail account secrets (§11.2, §36).
 *
 * Each secret row gets a random per-row data encryption key (DEK).
 * The DEK encrypts the actual secret payload (OAuth tokens, app passwords).
 * The DEK itself is encrypted (wrapped) with a key encryption key (KEK)
 * loaded from the environment.
 *
 * Format for both encrypted_dek and encrypted_payload:
 *   base64(nonce[12] + ciphertext + authTag[16])
 *
 * Algorithm: AES-256-GCM throughout.
 */

import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm" as const;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const DEK_LENGTH = 32;

// ---------------------------------------------------------------------------
// Low-level crypto helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Envelope encryption operations
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Effect service
// ---------------------------------------------------------------------------

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
			const kek = Buffer.from(Redacted.value(kekHex), "hex");

			if (kek.length !== 32) {
				return yield* Effect.fail(
					new Error("MAIL_KEK must be a 64-character hex string (32 bytes)"),
				);
			}

			return Service.of({
				encrypt: (payload) => envelopeEncrypt(kek, payload),
				decrypt: (encrypted) => envelopeDecrypt(kek, encrypted),
			});
		}),
	);

	export const defaultLayer = layer;
}
