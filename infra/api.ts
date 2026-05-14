import { hyperdrive } from "@leuchtturm/infra/database";
import { apiDomain, dns } from "@leuchtturm/infra/dns";
import { grafanaOtlpConfig } from "@leuchtturm/infra/grafana";
import { apiSecrets } from "@leuchtturm/infra/secrets";
import { storage } from "@leuchtturm/infra/storage";

export const api = new sst.cloudflare.Worker("ApiWorker", {
	handler: "apps/api/src/index.ts",
	placement: { mode: "smart" },
	domain: apiDomain,
	compatibility: {
		date: "2026-04-21",
	},
	link: [dns, storage, hyperdrive, grafanaOtlpConfig, ...apiSecrets],
	transform: {
		worker: (args: WorkerScriptArgs) => {
			args.bindings = $resolve(args.bindings!).apply((bindings) => [
				...bindings,
				{ name: "EMAIL", type: "send_email" },
			]);
		},
	},
});
