import { Resource } from "sst";

export namespace ApiConfig {
	export interface Axiom {
		readonly domain: string;
		readonly logsDataset: string;
		readonly token: string;
		readonly tracesDataset: string;
	}

	export interface PostHog {
		readonly apiKey: string;
		readonly host: string;
	}

	export const axiom = (): Axiom => ({
		domain: Resource.AxiomDomain.value,
		logsDataset: Resource.AxiomLogsDataset.value,
		token: Resource.AxiomToken.value,
		tracesDataset: Resource.AxiomTracesDataset.value,
	});

	export const posthog = (): PostHog => ({
		apiKey: Resource.PostHogProjectApiKey.value,
		host: Resource.PostHogHost.value,
	});
}
