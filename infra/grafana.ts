import * as grafana from "@pulumiverse/grafana";

const grafanaStage = "prod";
const cloudProvider = new grafana.Provider("GrafanaCloudProvider");

export let grafanaOtlpUrl: sst.Linkable<{ value: string }>;

if ($app.stage === grafanaStage) {
	const stack = new grafana.cloud.Stack(
		"GrafanaStack",
		{
			deleteProtection: $app.stage === "prod",
			description: `Leuchtturm ${$app.stage} observability`,
			labels: {
				app: $app.name,
				stage: $app.stage,
			},
			name: `${$app.name}-${$app.stage}`,
			regionSlug: "eu",
			slug: `${$app.name}${grafanaStage}`,
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
			url: stack.url,
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

	const prometheus = new grafana.oss.DataSource(
		"GrafanaPrometheusDataSource",
		{
			accessMode: "proxy",
			httpHeaders: {
				Authorization: serviceAccountToken.key.apply((token) => `Bearer ${token}`),
			},
			jsonDataEncoded: JSON.stringify({
				httpMethod: "POST",
				manageAlerts: true,
				prometheusType: "Mimir",
				prometheusVersion: "2.9.1",
			}),
			name: "Grafana Cloud Prometheus",
			type: "prometheus",
			uid: "grafanacloud-prometheus",
			url: stack.prometheusRemoteEndpoint,
		},
		{ provider: stackProvider },
	);

	const loki = new grafana.oss.DataSource(
		"GrafanaLokiDataSource",
		{
			accessMode: "proxy",
			httpHeaders: {
				Authorization: serviceAccountToken.key.apply((token) => `Bearer ${token}`),
			},
			jsonDataEncoded: JSON.stringify({ derivedFields: [] }),
			name: "Grafana Cloud Loki",
			type: "loki",
			uid: "grafanacloud-loki",
			url: stack.logsUrl,
		},
		{ provider: stackProvider },
	);

	const tempo = new grafana.oss.DataSource(
		"GrafanaTempoDataSource",
		{
			accessMode: "proxy",
			httpHeaders: {
				Authorization: serviceAccountToken.key.apply((token) => `Bearer ${token}`),
			},
			jsonDataEncoded: JSON.stringify({
				httpMethod: "GET",
				serviceMap: { datasourceUid: "grafanacloud-prometheus" },
				tracesToLogsV2: {
					datasourceUid: "grafanacloud-loki",
					filterByTraceID: true,
					spanStartTimeShift: "-1h",
					spanEndTimeShift: "1h",
				},
			}),
			name: "Grafana Cloud Tempo",
			type: "tempo",
			uid: "grafanacloud-tempo",
			url: stack.tracesUrl.apply((url) => `${url}/tempo`),
		},
		{ provider: stackProvider },
	);

	const dashboard = new grafana.oss.Dashboard(
		"GrafanaApiDashboard",
		{
			configJson: JSON.stringify({
				annotations: { list: [] },
				editable: true,
				fiscalYearStartMonth: 0,
				graphTooltip: 1,
				panels: [
					{
						datasource: { type: "prometheus", uid: "grafanacloud-prometheus" },
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
						datasource: { type: "prometheus", uid: "grafanacloud-prometheus" },
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
						datasource: { type: "loki", uid: "grafanacloud-loki" },
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
						datasource: { type: "tempo", uid: "grafanacloud-tempo" },
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
							datasource: { type: "prometheus", uid: "grafanacloud-prometheus" },
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
			folder: folder.uid,
			overwrite: true,
		},
		{ dependsOn: [prometheus, loki, tempo], provider: stackProvider },
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
							datasourceUid: "grafanacloud-prometheus",
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
		{ dependsOn: [prometheus], provider: stackProvider },
	);

	grafanaOtlpUrl = new sst.Linkable("GrafanaOtlpUrl", {
		properties: {
			value: stack.otlpUrl,
		},
	});
} else {
	const stack = grafana.cloud.getStackOutput(
		{
			slug: `${$app.name}${grafanaStage}`,
		},
		{ provider: cloudProvider },
	);
	grafanaOtlpUrl = new sst.Linkable("GrafanaOtlpUrl", {
		properties: {
			value: stack.apply((stack) => stack.otlpUrl),
		},
	});
}
