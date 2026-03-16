import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

i18n
	.use(LanguageDetector)
	.use(Backend)
	.use(initReactI18next)
	.init({
		supportedLngs: ["en", "de", "es", "fr", "it", "sq"],
		fallbackLng: "en",
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
