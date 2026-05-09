import { Resource } from "sst";

export namespace ApiConfig {
	export interface GrafanaObservability {
		readonly apiToken: string;
		readonly otlpUrl: string;
		readonly stage: string;
	}

	export interface PostHog {
		readonly apiKey: string;
		readonly host: string;
	}

	export const grafanaObservability = (): GrafanaObservability => ({
		apiToken: Resource.GrafanaObservability.ApiToken,
		otlpUrl: Resource.GrafanaObservability.OtlpUrl,
		stage: Resource.GrafanaObservability.Stage,
	});

	export const posthog = (): PostHog => ({
		apiKey: Resource.PostHogProjectApiKey.value,
		host: Resource.PostHogHost.value,
	});
}
