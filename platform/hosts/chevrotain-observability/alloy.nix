{...}: let
	cfg = import ../../../nix/config.nix;
in {
	services.alloy.enable = true;

	services.prometheus.exporters.node = {
		enable = true;
		port = cfg.ports.nodeExporter;
		enabledCollectors = ["systemd"];
	};

	networking.firewall.interfaces."tailscale0".allowedTCPPorts = [cfg.ports.alloyOtlp];

	environment.etc."alloy/config.alloy".text = ''
		// ── OTLP ingestion (from remote agent Alloys) ──

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
				metrics = [otelcol.exporter.prometheus.default.input]
				logs    = [otelcol.exporter.loki.default.input]
				traces  = [otelcol.exporter.otlphttp.tempo.input]
			}
		}

		// ── OTLP traces → Tempo ──

		otelcol.exporter.otlphttp "tempo" {
			client {
				endpoint = "http://127.0.0.1:${toString cfg.ports.tempoOtlp}"
				tls {
					insecure = true
				}
			}
		}

		// ── OTLP metrics → Prometheus ──

		otelcol.exporter.prometheus "default" {
			forward_to = [prometheus.remote_write.default.receiver]
		}

		// ── OTLP logs → Loki ──

		otelcol.exporter.loki "default" {
			forward_to = [loki.write.default.receiver]
		}

		// ── Prometheus scrape (local services) ──

		prometheus.scrape "node" {
			job_name        = "node"
			targets         = [{"__address__" = "127.0.0.1:${toString cfg.ports.nodeExporter}", "instance" = "observability"}]
			scrape_interval = "15s"
			forward_to      = [prometheus.remote_write.default.receiver]
		}

		prometheus.scrape "prometheus" {
			job_name        = "prometheus"
			targets         = [{"__address__" = "127.0.0.1:${toString cfg.ports.prometheus}"}]
			scrape_interval = "60s"
			forward_to      = [prometheus.remote_write.default.receiver]
		}

		prometheus.scrape "grafana" {
			job_name        = "grafana"
			targets         = [{"__address__" = "127.0.0.1:${toString cfg.ports.grafana}"}]
			scrape_interval = "60s"
			forward_to      = [prometheus.remote_write.default.receiver]
		}

		prometheus.scrape "loki" {
			job_name        = "loki"
			targets         = [{"__address__" = "127.0.0.1:${toString cfg.ports.loki}"}]
			scrape_interval = "60s"
			forward_to      = [prometheus.remote_write.default.receiver]
		}

		prometheus.scrape "tempo" {
			job_name        = "tempo"
			targets         = [{"__address__" = "127.0.0.1:${toString cfg.ports.tempo}"}]
			scrape_interval = "60s"
			forward_to      = [prometheus.remote_write.default.receiver]
		}

		prometheus.remote_write "default" {
			endpoint {
				url = "http://127.0.0.1:${toString cfg.ports.prometheus}/api/v1/write"
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
				url = "http://127.0.0.1:${toString cfg.ports.loki}/loki/api/v1/push"
			}
		}
	'';
}
