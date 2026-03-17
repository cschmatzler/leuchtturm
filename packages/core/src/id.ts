import { Schema } from "effect";
import { ulid } from "ulid";

export const PREFIXES = {
	account: "acc",
	user: "usr",
	session: "ses",
	verification: "ver",
	jwks: "jwk",
} as const;

export type IdPrefix = keyof typeof PREFIXES;

export function createId(prefix: IdPrefix): string {
	return [PREFIXES[prefix], ulid()].join("_");
}

const prefixValues = Object.values(PREFIXES) as string[];
const ulidPattern = /^[0-9A-Z]{26}$/;

export const Id = Schema.String.check(
	Schema.makeFilter((value: string) => {
		const parts = value.split("_");

		if (parts.length !== 2) {
			return "a valid ID format (prefix_ULID)";
		}

		const [prefix, id] = parts;
		if (!prefixValues.includes(prefix) || !ulidPattern.test(id)) {
			return "a valid ID format (prefix_ULID)";
		}

		return undefined;
	}),
);
