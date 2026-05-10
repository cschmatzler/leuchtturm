import { all } from "@pulumi/pulumi";
import * as grafana from "@pulumiverse/grafana";

import apiDashboard from "@leuchtturm/infra/grafana/api" with { type: "json" };

const cloudProvider = new grafana.Provider("GrafanaCloudProvider");
const grafanaCloudRegion = "eu";

const grafanaStack = (() => {
	// TODO: change this to `prod` when deploying
	if ($app.stage === "cschmatzler") {
		const stack = new grafana.cloud.Stack(
			"GrafanaStack",
			{
				name: $app.name,
				slug: "leuchtturmdev",
				description: `Leuchtturm observability`,
				deleteProtection: true,
				labels: {
					app: $app.name,
				},
				regionSlug: "eu",
			},
			{ provider: cloudProvider },
		);

		const serviceAccount = new grafana.cloud.StackServiceAccount(
			"GrafanaStackServiceAccount",
			{
				name: `${$app.name}-${$app.stage}-sst`,
				role: "Admin",
				stackSlug: stack.slug,
			},
			{ provider: cloudProvider },
		);

		const serviceAccountToken = new grafana.cloud.StackServiceAccountToken(
			"GrafanaStackServiceAccountToken",
			{
				name: `${$app.name}-${$app.stage}-sst-token`,
				serviceAccountId: serviceAccount.id,
				stackSlug: stack.slug,
			},
			{ provider: cloudProvider },
		);

		const stackProvider = new grafana.Provider(
			"GrafanaStackProvider",
			{
				auth: serviceAccountToken.key,
				stackId: stack.id.apply((id) => Number(id)),
				url: stack.slug.apply((slug) => `https://${slug}.grafana.net`),
			},
			{ dependsOn: [serviceAccountToken] },
		);

		const prometheusUid = stack.slug.apply((slug) => `grafanacloud-${slug}-prom`);

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
				configJson: stack.slug.apply((slug) =>
					JSON.stringify(apiDashboard)
						.replaceAll("__APP_STAGE__", $app.stage)
						.replaceAll("__GRAFANA_LOGS_UID__", `grafanacloud-${slug}-logs`)
						.replaceAll("__GRAFANA_PROMETHEUS_UID__", `grafanacloud-${slug}-prom`)
						.replaceAll("__GRAFANA_TRACES_UID__", `grafanacloud-${slug}-traces`),
				),
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
								datasourceUid: prometheusUid,
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

		return {
			id: stack.id,
			otlpUrl: stack.otlpUrl.apply((url) => (url.endsWith("/otlp") ? url : `${url}/otlp`)),
		};
	}

	const stack = grafana.cloud.getStackOutput(
		{
			slug: $app.name,
		},
		{ provider: cloudProvider },
	);

	return {
		id: stack.apply((stack) => stack.id),
		otlpUrl: stack.apply((stack) =>
			stack.otlpUrl.endsWith("/otlp") ? stack.otlpUrl : `${stack.otlpUrl}/otlp`,
		),
	};
})();

const telemetryAccessPolicy = new grafana.cloud.AccessPolicy(
	"GrafanaTelemetryAccessPolicy",
	{
		displayName: "Leuchtturm telemetry",
		name: `${$app.name}-${$app.stage}-telemetry`,
		realms: [{ identifier: grafanaStack.id, type: "stack" }],
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
		value: all([grafanaStack.id, telemetryAccessPolicyToken.token, grafanaStack.otlpUrl]).apply(
			([username, token, url]) =>
				JSON.stringify({
					authorization: `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`,
					url,
				}),
		),
	},
});
