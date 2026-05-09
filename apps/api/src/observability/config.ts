import { ApiConfig } from "@leuchtturm/api/config";

export const serviceName = "leuchtturm-api";
export const serviceNamespace = "leuchtturm";

export const makeResourceConfig = () => ({
	serviceName,
	attributes: {
		"cloud.platform": "cloudflare_workers",
		"cloud.provider": "cloudflare",
		"service.namespace": serviceNamespace,
	},
});

export const traceServiceConfig = {
	name: serviceName,
	namespace: serviceNamespace,
};

export const traceExporterConfig = () => {
	const config = ApiConfig.grafanaObservability();

	return {
		headers: {
			Authorization: `Bearer ${config.apiToken}`,
		},
		url: `${config.otlpUrl}/v1/traces`,
	};
};

export const getLogConfig = () => {
	const config = ApiConfig.grafanaObservability();

	return {
		stage: config.stage,
		token: config.apiToken,
		url: `${config.otlpUrl}/v1/logs`,
	};
};

export const getMetricConfig = () => {
	const config = ApiConfig.grafanaObservability();

	return {
		stage: config.stage,
		token: config.apiToken,
		url: `${config.otlpUrl}/v1/metrics`,
	};
};
