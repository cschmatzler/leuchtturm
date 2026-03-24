{...}: let
	cfg = import ../../nix/config.nix;
in {
	services.tempo = {
		enable = true;
		settings = {
			server = {
				http_listen_port = cfg.ports.tempo;
				http_listen_address = "0.0.0.0";
			};
			distributor.receivers.otlp.protocols.http.endpoint = "0.0.0.0:${toString cfg.ports.tempoOtlp}";
			metrics_generator = {
				registry.external_labels = {
					source = "tempo";
					cluster = "chevrotain";
				};
				storage = {
					path = "/var/lib/tempo/generator/wal";
					remote_write = [
						{
							url = "http://127.0.0.1:${toString cfg.ports.prometheus}/api/v1/write";
							send_exemplars = true;
						}
					];
				};
			};
			storage.trace = {
				backend = "local";
				local.path = "/var/lib/tempo/traces";
				wal.path = "/var/lib/tempo/wal";
			};
			compactor.compaction.block_retention = "720h";
			overrides.defaults.metrics_generator = {
				processors = ["span-metrics" "service-graphs"];
				generate_native_histograms = "both";
			};
		};
	};

	# Tempo is only accessed locally by the gateway Alloy and Grafana.
	# No Tailscale firewall ports needed.
}
