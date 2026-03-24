import { Schema } from "effect";

export const SUPPORTED_LANGUAGES = ["en", "de", "es", "fr", "it", "sq"] as const;

export const DEFAULT_LANGUAGE = "en" as const;

export const SupportedLanguageSchema = Schema.Literals(SUPPORTED_LANGUAGES);

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(language: string): language is SupportedLanguage {
	return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
}

export function resolveLanguage(
	language: string | null | undefined,
	fallback: SupportedLanguage = DEFAULT_LANGUAGE,
): SupportedLanguage {
	if (!language) return fallback;

	return isSupportedLanguage(language) ? language : fallback;
}
