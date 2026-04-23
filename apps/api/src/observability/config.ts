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
	const config = ApiConfig.axiom();

	return {
		domain: config.domain,
		token: config.token,
		tracesDataset: config.tracesDataset,
	};
};

export const getLogConfig = () => {
	const config = ApiConfig.axiom();

	return {
		dataset: config.logsDataset,
		domain: config.domain,
		token: config.token,
	};
};
