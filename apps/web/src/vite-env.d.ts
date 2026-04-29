/// <reference types="vite-plus/client" />

declare const __BUILD_HASH__: string;

interface ImportMetaEnv {
	readonly VITE_POSTHOG_HOST: string;
	readonly VITE_POSTHOG_KEY: string;
	readonly VITE_API_URL: string;
	readonly VITE_SYNC_URL: string;
}
