import { hyperdriveBinding } from "@leuchtturm/infra/database";
import { appDomain } from "@leuchtturm/infra/dns";
import { apiSecrets, secrets } from "@leuchtturm/infra/secrets";

const config = new sst.Linkable("ApiConfig", {
	properties: {
		BASE_URL: $interpolate`https://${appDomain}`,
		NODE_ENV: "production",
		POLAR_SERVER: "sandbox",
		POSTHOG_HOST: secrets.postHogHost,
	},
});

export const api = new sst.cloudflare.Worker("ApiWorker", {
	handler: "apps/api/src/index.ts",
	placement: { mode: "smart" },
	link: [config, hyperdriveBinding, ...apiSecrets],
});
