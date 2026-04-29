import { appDomain, syncDomain } from "@leuchtturm/infra/dns";
import { secrets } from "@leuchtturm/infra/secrets";

export const web = new sst.cloudflare.StaticSiteV2("Web", {
	path: "apps/web",
	domain: appDomain,
	trailingSlash: "drop",
	notFound: "single-page-application",
	environment: {
		VITE_API_URL: $interpolate`https://${appDomain}`,
		VITE_POSTHOG_HOST: secrets.postHogHost.value,
		VITE_POSTHOG_KEY: secrets.postHogProjectApiKey.value,
		VITE_SYNC_URL: $interpolate`https://${syncDomain}`,
	},
	build: {
		command: "pnpm run build",
		output: "dist",
	},
});
