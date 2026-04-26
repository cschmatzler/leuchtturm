import { Schema, SchemaGetter } from "effect";

export const Ulid = Schema.String.check(Schema.isPattern(/^[0-9A-Z]{26}$/)).annotate({
	message: "Invalid ID",
});

export const TrimmedNonEmptyString = Schema.String.pipe(
	Schema.decodeTo(Schema.NonEmptyString.annotate({ message: "Required" }), {
		decode: SchemaGetter.transform((s: string) => s.trim()),
		encode: SchemaGetter.transform((s: string) => s),
	}),
);

export const Email = Schema.String.pipe(
	Schema.decodeTo(
		Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)).annotate({
			message: "Email is invalid",
		}),
		{
			decode: SchemaGetter.transform((s: string) => s.trim().toLowerCase()),
			encode: SchemaGetter.transform((s: string) => s),
		},
	),
);
