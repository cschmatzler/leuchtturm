{...}: let
	cfg = import ../../../../nix/config.nix;
in {
	services.prometheus = {
		enable = true;
		port = cfg.ports.prometheus;
		retentionTime = "30d";
		extraFlags = ["--web.enable-remote-write-receiver"];
		listenAddress = "127.0.0.1";
		scrapeConfigs = [
			{
				job_name = "node";
				static_configs = [
					{
						targets = ["127.0.0.1:${toString cfg.ports.nodeExporter}"];
					}
				];
				scrape_interval = "15s";
			}
			{
				job_name = "postgres";
				static_configs = [
					{
						targets = ["127.0.0.1:${toString cfg.ports.postgresExporter}"];
					}
				];
				scrape_interval = "15s";
			}
			{
				job_name = "chevrotain-api";
				static_configs = [
					{
						targets = ["127.0.0.1:${toString cfg.ports.api}"];
					}
				];
				scrape_interval = "15s";
				metrics_path = "/api/metrics";
			}
			{
				job_name = "prometheus";
				static_configs = [
					{
						targets = ["127.0.0.1:${toString cfg.ports.prometheus}"];
					}
				];
				scrape_interval = "60s";
			}
			{
				job_name = "grafana";
				static_configs = [
					{
						targets = ["127.0.0.1:${toString cfg.ports.grafana}"];
					}
				];
				scrape_interval = "60s";
			}
			{
				job_name = "loki";
				static_configs = [
					{
						targets = ["127.0.0.1:${toString cfg.ports.loki}"];
					}
				];
				scrape_interval = "60s";
			}
			{
				job_name = "tempo";
				static_configs = [
					{
						targets = ["127.0.0.1:${toString cfg.ports.tempo}"];
					}
				];
				scrape_interval = "60s";
			}
		];
		exporters.node = {
			enable = true;
			port = cfg.ports.nodeExporter;
			enabledCollectors = ["systemd"];
		};
		exporters.postgres = {
			enable = true;
			port = cfg.ports.postgresExporter;
			runAsLocalSuperUser = true;
			extraFlags = [
				"--collector.stat_statements"
				"--collector.stat_statements.include_query"
				"--collector.stat_statements.query_length=200"
			];
		};
	};
}
