import { Schema, SchemaGetter } from "effect";

/** Non-empty string that trims whitespace during decoding. */
export const TrimmedNonEmptyString = Schema.String.pipe(
	Schema.decodeTo(Schema.NonEmptyString, {
		decode: SchemaGetter.transform((s: string) => s.trim()),
		encode: SchemaGetter.transform((s: string) => s),
	}),
);
