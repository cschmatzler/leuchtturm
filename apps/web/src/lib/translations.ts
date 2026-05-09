import { DEFAULT_LANGUAGE, SupportedLanguage } from "@leuchtturm/core/i18n";

type TranslationMap = Record<string, string>;

export const translatedLocales = SupportedLanguage.literals.filter(
	(locale) => locale !== DEFAULT_LANGUAGE,
);

export async function loadTranslations(locale: string): Promise<TranslationMap> {
	const response = await fetch(`/_gt/${locale}.json`);
	return response.json() as Promise<TranslationMap>;
}
