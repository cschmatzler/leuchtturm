{...}: let
	cfg = import ../../../nix/config.nix;
in {
	services.prometheus = {
		enable = true;
		port = cfg.ports.prometheus;
		retentionTime = "30d";
		extraFlags = ["--web.enable-remote-write-receiver"];
		listenAddress = "0.0.0.0";
		scrapeConfigs = [
			# Node metrics from all hosts
			{
				job_name = "node";
				static_configs = [
					{
						targets = ["127.0.0.1:${toString cfg.ports.nodeExporter}"];
						labels.instance = "observability";
					}
					{
						targets = ["${cfg.hosts.web}:${toString cfg.ports.nodeExporter}"];
						labels.instance = "web";
					}
					{
						targets = ["${cfg.hosts.zero}:${toString cfg.ports.nodeExporter}"];
						labels.instance = "zero";
					}
					{
						targets = ["${cfg.hosts.postgres}:${toString cfg.ports.nodeExporter}"];
						labels.instance = "postgres";
					}
				];
				scrape_interval = "15s";
				relabel_configs = [
					{
						source_labels = ["instance"];
						target_label = "instance";
					}
				];
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
			# Remote services via Tailscale
			{
				job_name = "postgres";
				static_configs = [
					{
						targets = ["${cfg.hosts.postgres}:${toString cfg.ports.postgresExporter}"];
					}
				];
				scrape_interval = "15s";
			}
			{
				job_name = "chevrotain-api";
				static_configs = [
					{
						targets = ["${cfg.hosts.web}:${toString cfg.ports.api}"];
					}
				];
				scrape_interval = "15s";
				metrics_path = "/api/metrics";
			}
		];
		exporters.node = {
			enable = true;
			port = cfg.ports.nodeExporter;
			enabledCollectors = ["systemd"];
		};
	};

	networking.firewall.interfaces."tailscale0".allowedTCPPorts = [
		cfg.ports.prometheus
	];
}
