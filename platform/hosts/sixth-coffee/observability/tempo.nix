{...}: let
	cfg = import ../../../../nix/config.nix;
in {
	services.tempo = {
		enable = true;
		settings = {
			server = {
				http_listen_port = cfg.ports.tempo;
				http_listen_address = "127.0.0.1";
			};
			distributor.receivers.otlp.protocols.http.endpoint = "127.0.0.1:${toString cfg.ports.tempoOtlp}";
			storage.trace = {
				backend = "local";
				local.path = "/var/lib/tempo/traces";
				wal.path = "/var/lib/tempo/wal";
			};
			compactor.compaction.block_retention = "720h";
		};
	};
}
