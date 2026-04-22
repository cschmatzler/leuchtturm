import { Resource } from "sst";

export namespace ApiConfig {
	type Resources = {
		readonly ApiConfig?: {
			readonly NODE_ENV?: string;
		};
		readonly AxiomDomain?: {
			readonly value?: string;
		};
		readonly AxiomLogsDataset?: {
			readonly value?: string;
		};
		readonly AxiomToken?: {
			readonly value?: string;
		};
		readonly AxiomTracesDataset?: {
			readonly value?: string;
		};
		readonly PostHogHost?: {
			readonly value?: string;
		};
		readonly PostHogProjectApiKey?: {
			readonly value?: string;
		};
	};

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

	const getResources = () => Resource as unknown as Resources;

	const requireValue = (name: string, value: string | undefined) => {
		if (!value) {
			throw new Error(`Missing required config: ${name}`);
		}

		return value;
	};

	export const deploymentEnvironment = () =>
		requireValue("ApiConfig.NODE_ENV", getResources().ApiConfig?.NODE_ENV);

	export const axiom = (): Axiom => {
		const resources = getResources();

		return {
			domain: requireValue("AxiomDomain", resources.AxiomDomain?.value),
			logsDataset: requireValue("AxiomLogsDataset", resources.AxiomLogsDataset?.value),
			token: requireValue("AxiomToken", resources.AxiomToken?.value),
			tracesDataset: requireValue("AxiomTracesDataset", resources.AxiomTracesDataset?.value),
		};
	};

	export const posthog = (): PostHog | undefined => {
		const resources = getResources();
		const apiKey = resources.PostHogProjectApiKey?.value;
		const host = resources.PostHogHost?.value;

		if (!apiKey || !host) {
			return undefined;
		}

		return {
			apiKey,
			host,
		};
	};
}
