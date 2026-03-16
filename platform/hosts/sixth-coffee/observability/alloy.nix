{...}: let
	cfg = import ../../../../nix/config.nix;
in {
	services.alloy.enable = true;

	networking.firewall.interfaces."docker0".allowedTCPPorts = [cfg.ports.alloyOtlp];

	environment.etc."alloy/config.alloy".text = ''
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

		otelcol.exporter.otlphttp "tempo" {
			client {
				endpoint = "http://127.0.0.1:${toString cfg.ports.tempoOtlp}"
				tls {
					insecure = true
				}
			}
		}

		otelcol.exporter.prometheus "default" {
			forward_to = [prometheus.remote_write.default.receiver]
		}

		prometheus.remote_write "default" {
			endpoint {
				url = "http://127.0.0.1:${toString cfg.ports.prometheus}/api/v1/write"
			}
		}

		otelcol.exporter.loki "default" {
			forward_to = [loki.write.default.receiver]
		}

		loki.write "default" {
			endpoint {
				url = "http://127.0.0.1:${toString cfg.ports.loki}/loki/api/v1/push"
			}
		}

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
	'';
}
