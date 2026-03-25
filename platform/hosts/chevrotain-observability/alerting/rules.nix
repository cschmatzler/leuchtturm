let
	prometheusUid = "prometheus";
	expressionUid = "-100";
	folder = "Chevrotain";
	intervalMs = 1000;
	maxDataPoints = 43200;

	mkPrometheusQuery = {
		refId ? "A",
		expr,
		from,
		legendFormat ? "__auto",
	}: {
		inherit refId;
		queryType = "";
		relativeTimeRange = {
			inherit from;
			to = 0;
		};
		datasourceUid = prometheusUid;
		model = {
			datasource = {
				type = "prometheus";
				uid = prometheusUid;
			};
			editorMode = "code";
			inherit expr intervalMs legendFormat maxDataPoints refId;
			hide = false;
			instant = true;
			range = false;
		};
	};

	mkThresholdCondition = {
		refId ? "B",
		queryRef ? "A",
		evaluatorType,
		threshold,
	}: {
		inherit refId;
		queryType = "";
		relativeTimeRange = {
			from = 0;
			to = 0;
		};
		datasourceUid = expressionUid;
		model = {
			conditions = [
				{
					evaluator = {
						params = [threshold];
						type = evaluatorType;
					};
					operator.type = "and";
					query.params = [queryRef];
					reducer = {
						params = [];
						type = "last";
					};
					type = "query";
				}
			];
			datasource = {
				type = "__expr__";
				uid = expressionUid;
			};
			hide = false;
			inherit intervalMs maxDataPoints refId;
			type = "classic_conditions";
		};
	};

	mkAlertRule = {
		uid,
		title,
		expr,
		threshold,
		evaluatorType ? "gt",
		forDuration,
		summary,
		description,
		dashboardUid,
		panelId,
		from ? 900,
		labels,
		noDataState ? "NoData",
		execErrState ? "Alerting",
	}: {
		inherit uid title dashboardUid panelId noDataState execErrState labels;
		condition = "B";
		"for" = forDuration;
		annotations = {
			inherit summary description;
		};
		data = [
			(mkPrometheusQuery {
					inherit expr from;
				})
			(mkThresholdCondition {
					inherit evaluatorType threshold;
				})
		];
		isPaused = false;
	};
in {
	apiVersion = 1;
	groups = [
		{
			name = "api";
			inherit folder;
			interval = "60s";
			rules = [
				(mkAlertRule {
						uid = "api_down";
						title = "API down";
						expr = ''max_over_time(up{job="chevrotain/api"}[2m])'';
						threshold = 1;
						evaluatorType = "lt";
						forDuration = "2m";
						summary = "Chevrotain API is down";
						description = "Prometheus has not seen the API target up for the last 2 minutes.";
						dashboardUid = "api";
						panelId = 2;
						from = 120;
						labels = {
							severity = "critical";
							service = "api";
							team = "platform";
						};
						noDataState = "Alerting";
					})
				(mkAlertRule {
						uid = "api_error_rate";
						title = "API error rate high";
						expr = ''sum(rate(http_requests_total{job="chevrotain/api", ok="false", route!="/api/metrics"}[5m])) / clamp_min(sum(rate(http_requests_total{job="chevrotain/api", route!="/api/metrics"}[5m])), 0.1) * 100'';
						threshold = 5;
						forDuration = "10m";
						summary = "API error rate is high";
						description = "More than 5% of API requests have failed for at least 10 minutes.";
						dashboardUid = "api";
						panelId = 4;
						from = 300;
						labels = {
							severity = "critical";
							service = "api";
							team = "platform";
						};
						noDataState = "OK";
					})
				(mkAlertRule {
						uid = "api_latency_p95";
						title = "API p95 latency high";
						expr = ''histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="chevrotain/api", route!="/api/metrics"}[5m])) by (le))'';
						threshold = 1;
						forDuration = "15m";
						summary = "API latency is elevated";
						description = "API p95 latency has stayed above 1 second for 15 minutes.";
						dashboardUid = "api";
						panelId = 5;
						from = 300;
						labels = {
							severity = "warning";
							service = "api";
							team = "platform";
						};
						noDataState = "OK";
					})
				(mkAlertRule {
						uid = "api_db_pool_waiting";
						title = "API DB pool backlog";
						expr = ''max_over_time(chevrotain_api_db_pool_clients{state="waiting"}[10m])'';
						threshold = 0;
						forDuration = "10m";
						summary = "API database pool has waiting clients";
						description = "The API database pool has had queued clients for the last 10 minutes.";
						dashboardUid = "api";
						panelId = 27;
						from = 600;
						labels = {
							severity = "warning";
							service = "api";
							team = "platform";
						};
					})
				(mkAlertRule {
						uid = "analytics_records_dropped";
						title = "Analytics records dropped";
						expr = ''increase(dropped_records_total[15m])'';
						threshold = 0;
						forDuration = "0s";
						summary = "Analytics or error records are being dropped";
						description = "The {{ $labels.pipeline }} pipeline has dropped telemetry records in the last 15 minutes.";
						dashboardUid = "api";
						panelId = 26;
						from = 900;
						labels = {
							severity = "warning";
							service = "api";
							team = "platform";
						};
						noDataState = "OK";
					})
			];
		}
		{
			name = "zero";
			inherit folder;
			interval = "60s";
			rules = [
				(mkAlertRule {
						uid = "zero_repl_mgr_down";
						title = "Zero replication manager down";
						expr = ''count(max_over_time(zero_server_uptime_seconds{job="chevrotain/zero-replication-manager"}[5m]) > 0)'';
						threshold = 1;
						evaluatorType = "lt";
						forDuration = "5m";
						summary = "Zero replication manager is down";
						description = "The Zero replication manager has not reported uptime for the last 5 minutes.";
						dashboardUid = "zero";
						panelId = 3;
						from = 300;
						labels = {
							severity = "critical";
							service = "zero";
							team = "platform";
						};
						noDataState = "Alerting";
					})
				(mkAlertRule {
						uid = "zero_syncers_degraded";
						title = "Zero view syncers degraded";
						expr = ''count(max_over_time(zero_server_uptime_seconds{job=~"chevrotain/zero-view-syncer-.*"}[5m]) > 0)'';
						threshold = 2;
						evaluatorType = "lt";
						forDuration = "10m";
						summary = "Zero is running below its configured syncer count";
						description = "At least one Zero view syncer has been missing for 10 minutes.";
						dashboardUid = "zero";
						panelId = 2;
						from = 300;
						labels = {
							severity = "warning";
							service = "zero";
							team = "platform";
						};
						noDataState = "Alerting";
					})
			];
		}
		{
			name = "postgres";
			inherit folder;
			interval = "60s";
			rules = [
				(mkAlertRule {
						uid = "postgres_down";
						title = "Postgres down";
						expr = ''max_over_time(up{job="postgres"}[2m])'';
						threshold = 1;
						evaluatorType = "lt";
						forDuration = "2m";
						summary = "Postgres is down";
						description = "Prometheus has not seen the Postgres exporter target up for the last 2 minutes.";
						dashboardUid = "postgres";
						panelId = 2;
						from = 120;
						labels = {
							severity = "critical";
							service = "postgres";
							team = "platform";
						};
						noDataState = "Alerting";
					})
				(mkAlertRule {
						uid = "postgres_conn_usage";
						title = "Postgres connection usage high";
						expr = ''sum(pg_stat_database_numbackends{job="postgres"}) / scalar(pg_settings_max_connections{job="postgres"}) * 100'';
						threshold = 70;
						forDuration = "10m";
						summary = "Postgres connection usage is high";
						description = "Postgres has used more than 70% of its configured connection limit for 10 minutes.";
						dashboardUid = "postgres";
						panelId = 9;
						from = 600;
						labels = {
							severity = "warning";
							service = "postgres";
							team = "platform";
						};
					})
				(mkAlertRule {
						uid = "postgres_deadlocks";
						title = "Postgres deadlocks detected";
						expr = ''increase(pg_stat_database_deadlocks{job="postgres", datname="chevrotain"}[15m])'';
						threshold = 0;
						forDuration = "0s";
						summary = "Postgres deadlocks detected";
						description = "Postgres has reported one or more deadlocks in the last 15 minutes.";
						dashboardUid = "postgres";
						panelId = 11;
						from = 900;
						labels = {
							severity = "warning";
							service = "postgres";
							team = "platform";
						};
					})
			];
		}
		{
			name = "hosts";
			inherit folder;
			interval = "60s";
			rules = [
				(mkAlertRule {
						uid = "host_root_disk_pressure";
						title = "Host root disk pressure";
						expr = ''max by (instance) ((1 - node_filesystem_avail_bytes{job="node", mountpoint="/", fstype!="rootfs"} / node_filesystem_size_bytes{job="node", mountpoint="/", fstype!="rootfs"}) * 100)'';
						threshold = 90;
						forDuration = "15m";
						summary = "A host is running low on root disk space";
						description = "{{ $labels.instance }} has kept root disk usage above 90% for 15 minutes.";
						dashboardUid = "node";
						panelId = 22;
						from = 900;
						labels = {
							severity = "critical";
							service = "hosts";
							team = "platform";
						};
					})
			];
		}
		{
			name = "observability";
			inherit folder;
			interval = "60s";
			rules = [
				(mkAlertRule {
						uid = "prometheus_down";
						title = "Prometheus down";
						expr = ''max_over_time(up{job="prometheus"}[5m])'';
						threshold = 1;
						evaluatorType = "lt";
						forDuration = "5m";
						summary = "Prometheus is down";
						description = "The observability stack has not seen Prometheus up for the last 5 minutes.";
						dashboardUid = "observability";
						panelId = 3;
						from = 300;
						labels = {
							severity = "critical";
							service = "observability";
							team = "platform";
						};
						noDataState = "Alerting";
					})
			];
		}
	];
}
