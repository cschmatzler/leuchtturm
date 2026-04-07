import { hyperdrive } from "@chevrotain/infra/database";
import { apiSecrets } from "@chevrotain/infra/secret";
import { webUrl } from "@chevrotain/infra/stage";

const apiConfig = new sst.Linkable("ApiConfig", {
	properties: {
		BASE_URL: webUrl,
		NODE_ENV: "production",
		POLAR_SERVER: "production",
	},
});

export const api = new sst.cloudflare.Worker("Api", {
	handler: "apps/api/src/index.ts",
	placement: { mode: "smart" },
	transform: {
		worker: (args) => {
			args.bindings = Promise.resolve(args.bindings ?? []).then((bindings) => [
				...bindings,
				{ type: "hyperdrive", name: "HYPERDRIVE", id: hyperdrive.id },
			]);
		},
	},
	link: [apiConfig, ...apiSecrets],
});
