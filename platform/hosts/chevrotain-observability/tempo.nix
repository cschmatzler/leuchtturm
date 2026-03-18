{...}: let
	cfg = import ../../../nix/config.nix;
in {
	services.tempo = {
		enable = true;
		settings = {
			server = {
				http_listen_port = cfg.ports.tempo;
				http_listen_address = "0.0.0.0";
			};
			distributor.receivers.otlp.protocols.http.endpoint = "0.0.0.0:${toString cfg.ports.tempoOtlp}";
			storage.trace = {
				backend = "local";
				local.path = "/var/lib/tempo/traces";
				wal.path = "/var/lib/tempo/wal";
			};
			compactor.compaction.block_retention = "720h";
		};
	};

	networking.firewall.interfaces."tailscale0".allowedTCPPorts = [
		cfg.ports.tempo
		cfg.ports.tempoOtlp
	];
}
