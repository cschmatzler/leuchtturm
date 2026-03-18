{
	lib,
	pkgs,
	...
}: {
	services.postgresql = {
		enable = true;
		package = pkgs.postgresql_18;
		settings = {
			listen_addresses = lib.mkForce "*";
			wal_level = "logical";
			log_connections = true;
			log_disconnections = true;
		};
		authentication =
			pkgs.lib.mkOverride 10 ''
				local   all       prometheus                  trust
				local   all       all                         peer
				host    all       all         127.0.0.1/32    scram-sha-256
				host    all       all         ::1/128         scram-sha-256
				host    chevrotain grafana    100.64.0.0/10   trust
				host    all       all         100.64.0.0/10   scram-sha-256
			'';
	};

	networking.firewall.interfaces."tailscale0".allowedTCPPorts = [5432];
}
