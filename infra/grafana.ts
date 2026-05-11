import { all } from "@pulumi/pulumi";
import * as grafana from "@pulumiverse/grafana";

import apiDashboard from "@leuchtturm/infra/grafana/api" with { type: "json" };

const cloudProvider = new grafana.Provider("GrafanaCloudProvider");

const grafanaStack = grafana.cloud.getStackOutput(
	{
		slug: "leuchtturmdev",
	},
	{ provider: cloudProvider },
);

const serviceAccount = new grafana.cloud.StackServiceAccount(
	"GrafanaStackServiceAccount",
	{
		name: `${$app.name}-${$app.stage}-sst`,
		role: "Admin",
		stackSlug: "leuchtturmdev",
	},
	{ provider: cloudProvider },
);

const serviceAccountToken = new grafana.cloud.StackServiceAccountToken(
	"GrafanaStackServiceAccountToken",
	{
		name: `${$app.name}-${$app.stage}-sst-token`,
		serviceAccountId: serviceAccount.id,
		stackSlug: "leuchtturmdev",
	},
	{ provider: cloudProvider },
);

const stackProvider = new grafana.Provider(
	"GrafanaStackProvider",
	{
		auth: serviceAccountToken.key,
		stackId: grafanaStack.apply((stack) => Number(stack.id)),
		url: "https://leuchtturmdev.grafana.net",
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
			.replaceAll("__GRAFANA_LOGS_UID__", "grafanacloud-leuchtturmdev-logs")
			.replaceAll("__GRAFANA_PROMETHEUS_UID__", "grafanacloud-leuchtturmdev-prom")
			.replaceAll("__GRAFANA_TRACES_UID__", "grafanacloud-leuchtturmdev-traces"),
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
						datasourceUid: "grafanacloud-leuchtturmdev-prom",
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
		realms: [{ identifier: grafanaStack.apply((stack) => stack.id), type: "stack" }],
		region: grafanaStack.apply((stack) => stack.regionSlug),
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
		region: grafanaStack.apply((stack) => stack.regionSlug),
	},
	{ provider: cloudProvider },
);

export const grafanaOtlpUrl = new sst.Linkable("GrafanaOtlpUrl", {
	properties: {
		value: all({
			username: grafanaStack.apply((stack) => stack.id),
			token: telemetryAccessPolicyToken.token,
			url: grafanaStack.apply((stack) => `${stack.otlpUrl}/otlp`),
		}).apply(({ username, token, url }: { token: string; url: string; username: string }) =>
			JSON.stringify({
				authorization: `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`,
				url,
			}),
		),
	},
});
