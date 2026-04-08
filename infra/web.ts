import { syncDomain } from "@leuchtturm/infra/dns";

export const web = new sst.cloudflare.StaticSite("Web", {
	path: "apps/web",
	environment: {
		VITE_SYNC_URL: $interpolate`https://${syncDomain}`,
	},
	build: {
		command: "pnpm run build",
		output: "dist",
	},
	url: false,
});
