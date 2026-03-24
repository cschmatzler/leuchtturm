{...}: let
	cfg = import ../../nix/config.nix;
	viewSyncerUpstreams = builtins.concatStringsSep " " (map (port: "localhost:${toString port}") cfg.zero.viewSyncerPorts);
in {
	services.caddy = {
		enable = true;
		virtualHosts."sync.${cfg.domain}" = {
			extraConfig = ''
				reverse_proxy ${viewSyncerUpstreams} {
					lb_policy cookie zero_sync
					health_uri /keepalive
					health_interval 5s
					health_timeout 5s
				}
			'';
		};
	};

	networking.firewall.allowedTCPPorts = [80 443];
}
