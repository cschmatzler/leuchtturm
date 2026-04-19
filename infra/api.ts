import { hyperdriveBinding } from "@leuchtturm/infra/database";
import { appDomain } from "@leuchtturm/infra/dns";
import { apiSecrets, secrets } from "@leuchtturm/infra/secrets";
import { storage } from "@leuchtturm/infra/storage";

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
	link: [config, storage, hyperdriveBinding, ...apiSecrets],
});

const workflowWorker = new sst.cloudflare.Worker("ApiWorkflowWorker", {
	handler: "apps/api/src/mail/gmail/bootstrap.ts",
	link: [config, storage, hyperdriveBinding, ...apiSecrets],
});

new cloudflare.Workflow("GmailBootstrapWorkflow", {
	accountId: sst.cloudflare.DEFAULT_ACCOUNT_ID,
	workflowName: "bootstrap",
	className: "GmailBootstrapWorkflow",
	scriptName: workflowWorker.nodes.worker.scriptName,
});
