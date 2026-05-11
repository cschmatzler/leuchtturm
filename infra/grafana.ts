import { all } from "@pulumi/pulumi";
import * as grafana from "@pulumiverse/grafana";

import apiDashboard from "@leuchtturm/infra/grafana/api" with { type: "json" };

const cloudProvider = new grafana.Provider("GrafanaCloudProvider");
const grafanaCloudRegion = "eu";

const grafanaStackSlug = "leuchtturmdev";

const grafanaStack = grafana.cloud.getStackOutput(
	{
		slug: grafanaStackSlug,
	},
	{ provider: cloudProvider },
);

const grafanaStackId = grafanaStack.apply((stack) => stack.id);
const grafanaStackOtlpUrl = grafanaStack.apply((stack) =>
	stack.otlpUrl.endsWith("/otlp") ? stack.otlpUrl : `${stack.otlpUrl}/otlp`,
);

const serviceAccount = new grafana.cloud.StackServiceAccount(
	"GrafanaStackServiceAccount",
	{
		name: `${$app.name}-${$app.stage}-sst`,
		role: "Admin",
		stackSlug: grafanaStackSlug,
	},
	{ provider: cloudProvider },
);

const serviceAccountToken = new grafana.cloud.StackServiceAccountToken(
	"GrafanaStackServiceAccountToken",
	{
		name: `${$app.name}-${$app.stage}-sst-token`,
		serviceAccountId: serviceAccount.id,
		stackSlug: grafanaStackSlug,
	},
	{ provider: cloudProvider },
);

const stackProvider = new grafana.Provider(
	"GrafanaStackProvider",
	{
		auth: serviceAccountToken.key,
		stackId: grafanaStackId.apply((id) => Number(id)),
		url: `https://${grafanaStackSlug}.grafana.net`,
	},
	{ dependsOn: [serviceAccountToken] },
);

const folder = new grafana.oss.Folder(
	"GrafanaFolder",
	{
		title: "Leuchtturm",
		uid: "leuchtturm",
	},
	{ provider: stackProvider },
);

new grafana.oss.Dashboard(
	"GrafanaApiDashboard",
	{
		configJson: JSON.stringify(apiDashboard)
			.replaceAll("__APP_STAGE__", $app.stage)
			.replaceAll("__GRAFANA_LOGS_UID__", `grafanacloud-${grafanaStackSlug}-logs`)
			.replaceAll("__GRAFANA_PROMETHEUS_UID__", `grafanacloud-${grafanaStackSlug}-prom`)
			.replaceAll("__GRAFANA_TRACES_UID__", `grafanacloud-${grafanaStackSlug}-traces`),
		folder: folder.uid,
		overwrite: true,
	},
	{ provider: stackProvider },
);

new grafana.alerting.RuleGroup(
	"GrafanaApiAlertRules",
	{
		folderUid: folder.uid,
		intervalSeconds: 60,
		name: "Leuchtturm API",
		rules: [
			{
				condition: "A",
				datas: [
					{
						datasourceUid: `grafanacloud-${grafanaStackSlug}-prom`,
						model: JSON.stringify({
							expr: 'sum(rate(api_request_errors_total{stage=~".*"}[5m])) > 0',
							instant: true,
							refId: "A",
						}),
						refId: "A",
						relativeTimeRange: { from: 300, to: 0 },
					},
				],
				execErrState: "Error",
				for: "5m",
				name: "API 5xx errors",
				noDataState: "NoData",
			},
		],
	},
	{ provider: stackProvider },
);

const telemetryAccessPolicy = new grafana.cloud.AccessPolicy(
	"GrafanaTelemetryAccessPolicy",
	{
		displayName: "Leuchtturm telemetry",
		name: `${$app.name}-${$app.stage}-telemetry`,
		realms: [{ identifier: grafanaStackId, type: "stack" }],
		region: grafanaCloudRegion,
		scopes: ["stacks:read", "logs:write", "metrics:write", "traces:write"],
	},
	{ provider: cloudProvider },
);

const telemetryAccessPolicyToken = new grafana.cloud.AccessPolicyToken(
	"GrafanaTelemetryAccessPolicyToken",
	{
		accessPolicyId: telemetryAccessPolicy.policyId,
		displayName: "Leuchtturm telemetry token",
		name: `${$app.name}-${$app.stage}-telemetry-token`,
		region: grafanaCloudRegion,
	},
	{ provider: cloudProvider },
);

export const grafanaOtlpUrl = new sst.Linkable("GrafanaOtlpUrl", {
	properties: {
		value: all([grafanaStackId, telemetryAccessPolicyToken.token, grafanaStackOtlpUrl]).apply(
			([username, token, url]) =>
				JSON.stringify({
					authorization: `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`,
					url,
				}),
		),
	},
});
