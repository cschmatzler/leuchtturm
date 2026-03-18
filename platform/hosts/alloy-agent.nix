{
	config,
	lib,
	...
}: let
	cfg = import ../../nix/config.nix;
	instanceName = builtins.replaceStrings ["chevrotain-"] [""] config.networking.hostName;
in {
	options.chevrotain.alloy.extraConfig =
		lib.mkOption {
			type = lib.types.lines;
			default = "";
			description = "Additional Alloy configuration appended to the base agent config.";
		};

	config = {
		services.alloy.enable = true;

		services.prometheus.exporters.node = {
			enable = true;
			port = cfg.ports.nodeExporter;
			enabledCollectors = ["systemd"];
		};

		environment.etc."alloy/config.alloy".text = ''
			// ── OTLP push pipeline (apps → gateway Alloy) ──

			otelcol.receiver.otlp "default" {
				http {
					endpoint = "0.0.0.0:${toString cfg.ports.alloyOtlp}"
				}
				output {
					metrics = [otelcol.processor.batch.default.input]
					logs    = [otelcol.processor.batch.default.input]
					traces  = [otelcol.processor.batch.default.input]
				}
			}

			otelcol.processor.batch "default" {
				timeout = "5s"
				output {
					metrics = [otelcol.exporter.otlphttp.gateway.input]
					logs    = [otelcol.exporter.otlphttp.gateway.input]
					traces  = [otelcol.exporter.otlphttp.gateway.input]
				}
			}

			otelcol.exporter.otlphttp "gateway" {
				client {
					endpoint = "http://${cfg.hosts.observability}:${toString cfg.ports.alloyOtlp}"
					tls {
						insecure = true
					}
				}
			}

			// ── Prometheus scrape (local exporters → remote Prometheus) ──

			prometheus.scrape "node" {
				job_name        = "node"
				targets         = [{"__address__" = "127.0.0.1:${toString cfg.ports.nodeExporter}", "instance" = "${instanceName}"}]
				scrape_interval = "15s"
				forward_to      = [prometheus.remote_write.default.receiver]
			}

			prometheus.remote_write "default" {
				endpoint {
					url = "http://${cfg.hosts.observability}:${toString cfg.ports.prometheus}/api/v1/write"
				}
			}

			// ── Journal logs → Loki ──

			loki.source.journal "default" {
				relabel_rules = loki.relabel.journal.rules
				forward_to    = [loki.write.default.receiver]
			}

			loki.relabel "journal" {
				forward_to = []

				rule {
					source_labels = ["__journal__systemd_unit"]
					target_label  = "unit"
				}

				rule {
					source_labels = ["__journal__hostname"]
					target_label  = "hostname"
				}

				rule {
					source_labels = ["__journal_priority_keyword"]
					target_label  = "level"
				}

				rule {
					source_labels = ["unit"]
					regex         = "docker\\.service"
					action        = "drop"
				}
			}

			loki.write "default" {
				endpoint {
					url = "http://${cfg.hosts.observability}:${toString cfg.ports.loki}/loki/api/v1/push"
				}
			}

			// ── Per-node extra config ──

			${config.chevrotain.alloy.extraConfig}
		'';
	};
}
