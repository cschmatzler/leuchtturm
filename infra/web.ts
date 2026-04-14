import { syncDomain } from "@leuchtturm/infra/dns";
import { secrets } from "@leuchtturm/infra/secrets";

export const web = new sst.cloudflare.StaticSite("Web", {
	path: "apps/web",
	environment: {
		VITE_POSTHOG_HOST: "https://eu.i.posthog.com",
		VITE_POSTHOG_KEY: secrets.postHogProjectApiKey.value,
		VITE_SYNC_URL: $interpolate`https://${syncDomain}`,
	},
	build: {
		command: "pnpm run build",
		output: "dist",
	},
	url: false,
});
