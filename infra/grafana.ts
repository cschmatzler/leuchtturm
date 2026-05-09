import * as grafana from "@pulumiverse/grafana";

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
					JSON.stringify({
						annotations: { list: [] },
						editable: true,
						fiscalYearStartMonth: 0,
						graphTooltip: 1,
						panels: [
							{
								datasource: { type: "prometheus", uid: `grafanacloud-${slug}-prom` },
								fieldConfig: { defaults: { unit: "reqps" }, overrides: [] },
								gridPos: { h: 8, w: 12, x: 0, y: 0 },
								id: 1,
								targets: [
									{
										expr: 'sum by (route, method) (rate(api_requests_total{stage=~"$stage"}[5m]))',
										legendFormat: "{{method}} {{route}}",
										refId: "A",
									},
								],
								title: "API request rate",
								type: "timeseries",
							},
							{
								datasource: { type: "prometheus", uid: `grafanacloud-${slug}-prom` },
								fieldConfig: { defaults: { unit: "ms" }, overrides: [] },
								gridPos: { h: 8, w: 12, x: 12, y: 0 },
								id: 2,
								targets: [
									{
										expr: 'sum by (route, method) (rate(api_request_duration_ms_sum{stage=~"$stage"}[5m])) / sum by (route, method) (rate(api_request_duration_ms_count{stage=~"$stage"}[5m]))',
										legendFormat: "{{method}} {{route}}",
										refId: "A",
									},
								],
								title: "Average API duration",
								type: "timeseries",
							},
							{
								datasource: { type: "loki", uid: `grafanacloud-${slug}-logs` },
								gridPos: { h: 10, w: 12, x: 0, y: 8 },
								id: 3,
								targets: [
									{
										expr: '{app="leuchtturm", stage=~"$stage", service_name="leuchtturm-api"} | json',
										refId: "A",
									},
								],
								title: "API logs",
								type: "logs",
							},
							{
								datasource: { type: "tempo", uid: `grafanacloud-${slug}-traces` },
								gridPos: { h: 10, w: 12, x: 12, y: 8 },
								id: 4,
								targets: [{ query: "leuchtturm-api", queryType: "serviceMap", refId: "A" }],
								title: "API traces",
								type: "nodeGraph",
							},
						],
						refresh: "30s",
						schemaVersion: 39,
						tags: ["leuchtturm", "api"],
						templating: {
							list: [
								{
									current: { selected: true, text: $app.stage, value: $app.stage },
									datasource: { type: "prometheus", uid: `grafanacloud-${slug}-prom` },
									definition: "label_values(api_requests_total, stage)",
									label: "Stage",
									name: "stage",
									query: {
										query: "label_values(api_requests_total, stage)",
										refId: "StandardVariableQuery",
									},
									refresh: 1,
									type: "query",
								},
							],
						},
						time: { from: "now-6h", to: "now" },
						timezone: "browser",
						title: "Leuchtturm API",
						uid: "leuchtturm-api",
						version: 1,
					}),
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
			otlpUrl: stack.otlpUrl,
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
		otlpUrl: stack.apply((stack) => stack.otlpUrl),
	};
})();

const telemetryAccessPolicy = new grafana.cloud.AccessPolicy(
	"GrafanaTelemetryAccessPolicy",
	{
		displayName: "Leuchtturm telemetry",
		name: `${$app.name}-${$app.stage}-telemetry`,
		realms: [{ identifier: grafanaStack.id, type: "stack" }],
		region: grafanaCloudRegion,
		scopes: ["logs:write", "metrics:write", "traces:write"],
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
		token: telemetryAccessPolicyToken.token,
		username: grafanaStack.id,
		value: grafanaStack.otlpUrl,
	},
});
