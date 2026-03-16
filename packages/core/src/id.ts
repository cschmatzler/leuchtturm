import { type } from "arktype";
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

export const Id = type("string").narrow((value, ctx) => {
	const parts = value.split("_");

	if (parts.length !== 2) {
		return ctx.mustBe("a valid ID format (prefix_ULID)");
	}

	const [prefix, id] = parts;
	if (
		!Object.values(PREFIXES).includes(prefix as (typeof PREFIXES)[keyof typeof PREFIXES]) ||
		!/^[0-9A-Z]{26}$/.test(id)
	) {
		return ctx.mustBe("a valid ID format (prefix_ULID)");
	}

	return true;
});
