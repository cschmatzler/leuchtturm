import { DEFAULT_LANGUAGE, SupportedLanguage } from "@leuchtturm/core/i18n";

type TranslationMap = Record<string, unknown>;

const translationLoaders = import.meta.glob<TranslationMap>("../_gt/*.json", {
	import: "default",
});

export const translatedLocales = SupportedLanguage.literals.filter(
	(locale) => locale !== DEFAULT_LANGUAGE,
);

export async function loadTranslations(locale: string): Promise<TranslationMap> {
	const loader = translationLoaders[`../_gt/${locale}.json`];
	if (!loader) return {};
	return await loader();
}
