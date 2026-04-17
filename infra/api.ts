import { output } from "@pulumi/pulumi";

import { hyperdrive } from "@leuchtturm/infra/database";
import { appDomain } from "@leuchtturm/infra/dns";
import { apiSecrets, secrets } from "@leuchtturm/infra/secrets";

const gmailBootstrapWorkflowName = `${$app.name}-${$app.stage}-gmail-bootstrap`;

const config = new sst.Linkable("ApiConfig", {
	properties: {
		BASE_URL: $interpolate`https://${appDomain}`,
		NODE_ENV: "production",
		POLAR_SERVER: "sandbox",
		POSTHOG_HOST: secrets.postHogHost,
	},
});

const withHyperdriveBinding = (args: any) => {
	args.bindings = output(args.bindings ?? []).apply((bindings) => [
		...bindings,
		{ type: "hyperdrive", name: "HYPERDRIVE", id: hyperdrive.id },
	]);
};

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
			withHyperdriveBinding(args);
			args.bindings = output(args.bindings ?? []).apply((bindings) => [
				...bindings,
				{
					type: "workflow",
					name: "GMAIL_BOOTSTRAP_WORKFLOW",
					workflowName: gmailBootstrapWorkflowName,
				},
			]);
		},
	},
	link: [config, ...apiSecrets],
});

const workflowWorker = new sst.cloudflare.Worker("ApiWorkflowWorker", {
	handler: "apps/api/src/mail/gmail/bootstrap.ts",
	transform: {
		worker: withHyperdriveBinding,
	},
	link: [config, ...apiSecrets],
});

export const gmailBootstrapWorkflow = new cloudflare.Workflow("GmailBootstrapWorkflow", {
	accountId: sst.cloudflare.DEFAULT_ACCOUNT_ID,
	workflowName: gmailBootstrapWorkflowName,
	className: "GmailBootstrapWorkflow",
	scriptName: workflowWorker.nodes.worker.scriptName,
});
