{
	config,
	pkgs,
	...
}: let
	cfg = import ../../../../nix/config.nix;
in {
	services.grafana = {
		enable = true;
		declarativePlugins = with pkgs.grafanaPlugins; [
			grafana-clickhouse-datasource
		];
		settings = {
			server = {
				http_port = cfg.ports.grafana;
				http_addr = "0.0.0.0";
				domain = "sixth-coffee";
			};
			security = {
				admin_password = "$__file{${config.sops.secrets.grafana-admin-password.path}}";
				secret_key = "$__file{${config.sops.secrets.grafana-secret-key.path}}";
			};
		};
		provision.dashboards.settings.providers = [
			{
				name = "default";
				options.path = ./dashboards;
			}
		];
		provision.datasources.settings.datasources = [
			{
				name = "Prometheus";
				uid = "prometheus";
				type = "prometheus";
				url = "http://127.0.0.1:${toString cfg.ports.prometheus}";
				isDefault = true;
			}
			{
				name = "Loki";
				uid = "loki";
				type = "loki";
				url = "http://127.0.0.1:${toString cfg.ports.loki}";
				jsonData = {
					derivedFields = [
						{
							name = "TraceID";
							matcherRegex = "traceID=(\\w+)";
							url = "$${__value.raw}";
							datasourceUid = "tempo";
							matcherType = "regex";
						}
					];
				};
			}
			{
				name = "Tempo";
				uid = "tempo";
				type = "tempo";
				url = "http://127.0.0.1:${toString cfg.ports.tempo}";
				jsonData = {
					httpMethod = "GET";
					streamingEnabled = {
						search = false;
						metrics = false;
					};
					tracesToLogsV2 = {
						datasourceUid = "loki";
						filterByTraceID = true;
						filterBySpanID = true;
					};
					tracesToMetrics = {
						datasourceUid = "prometheus";
					};
					nodeGraph = {
						enabled = true;
					};
					serviceMap = {
						datasourceUid = "prometheus";
					};
				};
			}
			{
				name = "PostgreSQL";
				uid = "postgres";
				type = "postgres";
				url = "127.0.0.1:5432";
				user = "grafana";
				jsonData = {
					database = "chevrotain";
					sslmode = "disable";
					postgresVersion = 1600;
				};
				secureJsonData = {
					password = "$__file{${config.sops.secrets.grafana-db-password.path}}";
				};
			}
			{
				name = "ClickHouse";
				uid = "clickhouse";
				type = "grafana-clickhouse-datasource";
				jsonData = {
					defaultDatabase = "default";
					protocol = "http";
					host = "127.0.0.1";
					server = "127.0.0.1";
					port = cfg.ports.clickhouse;
					username = "default";
					tlsSkipVerify = false;
				};
			}
		];
	};
}
