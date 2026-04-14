import { output } from "@pulumi/pulumi";

import { hyperdrive } from "@leuchtturm/infra/database";
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
	transform: {
		observability: {
			enabled: false,
			headSamplingRate: 1,
			logs: {
				enabled: true,
				headSamplingRate: 1,
				persist: true,
				invocationLogs: true,
			},
		},
		worker: (args: any) => {
			args.bindings = output(args.bindings ?? []).apply((bindings) => [
				...bindings,
				{ type: "hyperdrive", name: "HYPERDRIVE", id: hyperdrive.id },
			]);
		},
	},
	link: [config, ...apiSecrets],
});
