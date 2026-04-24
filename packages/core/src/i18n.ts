import { Schema } from "effect";

export const SupportedLanguage = Schema.Literals(["en", "de", "es", "fr", "it", "sq"]);

export const DEFAULT_LANGUAGE: typeof SupportedLanguage.Type = "en";

export function resolveLanguage(
	language: string | null | undefined,
	fallback: typeof SupportedLanguage.Type = DEFAULT_LANGUAGE,
): typeof SupportedLanguage.Type {
	return language && Schema.is(SupportedLanguage)(language) ? language : fallback;
}
