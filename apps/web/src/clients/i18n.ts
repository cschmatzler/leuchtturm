import { GTProvider, useGT, useLocale, useSetLocale } from "gt-react";
import { createElement, type ReactNode } from "react";

import { DEFAULT_LANGUAGE, SupportedLanguage } from "@leuchtturm/core/i18n";

type TranslationMap = Record<string, string>;
type TranslationModule = { default: TranslationMap };

const translationLoaders = import.meta.glob<TranslationModule>("../_gt/*.json");
const interpolationPattern = /\{\{\s*([\w.]+)\s*\}\}/g;

export function TranslationProvider({ children }: { children: ReactNode }) {
	return createElement(
		GTProvider,
		{
			defaultLocale: DEFAULT_LANGUAGE,
			locales: SupportedLanguage.literals.filter((locale) => locale !== DEFAULT_LANGUAGE),
			loadTranslations: async (locale: string) => {
				const loader = translationLoaders[`../_gt/${locale}.json`];
				if (!loader) return {};
				return (await loader()).default;
			},
		},
		children,
	);
}

export function useTranslation() {
	const gt = useGT();
	const locale = useLocale();
	const setLocale = useSetLocale();

	return {
		t(message: string, options: Record<string, unknown> = {}) {
			return gt(message.replace(interpolationPattern, "{$1}"), { $id: message, ...options });
		},
		i18n: {
			language: locale,
			resolvedLanguage: locale,
			async changeLanguage(language: string) {
				setLocale(language);
			},
		},
	};
}

export const defaultLocale = DEFAULT_LANGUAGE;
export const locales = [...SupportedLanguage.literals];
