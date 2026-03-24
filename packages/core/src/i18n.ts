import { Schema } from "effect";

export const SUPPORTED_LANGUAGES = ["en", "de", "es", "fr", "it", "sq"] as const;

export const DEFAULT_LANGUAGE = "en" as const;

export const SupportedLanguageSchema = Schema.Literals(SUPPORTED_LANGUAGES);

export type SupportedLanguage = typeof SupportedLanguageSchema.Type;

const supportedLanguageSet = new Set<string>(SUPPORTED_LANGUAGES);

export function isSupportedLanguage(language: string): language is SupportedLanguage {
	return supportedLanguageSet.has(language);
}

export function resolveLanguage(
	language: string | null | undefined,
	fallback: SupportedLanguage = DEFAULT_LANGUAGE,
): SupportedLanguage {
	if (!language) return fallback;

	return isSupportedLanguage(language) ? language : fallback;
}
