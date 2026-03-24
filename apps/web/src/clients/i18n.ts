import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@chevrotain/core/i18n";

i18n
	.use(LanguageDetector)
	.use(Backend)
	.use(initReactI18next)
	.init({
		supportedLngs: [...SUPPORTED_LANGUAGES],
		fallbackLng: DEFAULT_LANGUAGE,
		keySeparator: false,
		interpolation: {
			escapeValue: false,
		},
		backend: {
			loadPath: "/locales/{{lng}}/{{ns}}.json",
			queryStringParams: { v: __BUILD_HASH__ },
		},
		partialBundledLanguages: true,
	});

export { i18n };
