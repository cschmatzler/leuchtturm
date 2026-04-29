import { output } from "@pulumi/pulumi";

import { hyperdrive } from "@leuchtturm/infra/database";
import { appDomain } from "@leuchtturm/infra/dns";
import { apiSecrets } from "@leuchtturm/infra/secrets";
import { storage } from "@leuchtturm/infra/storage";

const config = new sst.Linkable("ApiConfig", {
	properties: {
		BASE_URL: $interpolate`https://${appDomain}`,
		POLAR_SERVER: "sandbox",
	},
});

export const api = new sst.cloudflare.Worker("ApiWorker", {
	handler: "apps/api/src/index.ts",
	placement: { mode: "smart" },
	domain: appDomain,
	compatibility: {
		date: "2026-04-21",
	},
	link: [config, storage, hyperdrive, ...apiSecrets],
	transform: {
		worker: (args: any) => {
			args.bindings = output(args.bindings).apply((bindings) => [
				...(bindings ?? []),
				{ name: "EMAIL", type: "send_email" },
			]);
		},
	},
});
