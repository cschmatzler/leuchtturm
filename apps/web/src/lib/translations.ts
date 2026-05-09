import { DEFAULT_LANGUAGE, SupportedLanguage } from "@leuchtturm/core/i18n";

type TranslationMap = Record<string, unknown>;
type TranslationModule = { default: TranslationMap };

const translationLoaders = import.meta.glob<TranslationModule>("../_gt/*.json");

export const translatedLocales = SupportedLanguage.literals.filter(
	(locale) => locale !== DEFAULT_LANGUAGE,
);

export async function loadTranslations(locale: string): Promise<TranslationMap> {
	const loader = translationLoaders[`../_gt/${locale}.json`];
	if (!loader) return {};
	return (await loader()).default;
}
