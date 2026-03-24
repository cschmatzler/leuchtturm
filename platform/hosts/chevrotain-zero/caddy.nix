{...}: let
	cfg = import ../../nix/config.nix;
in {
	services.caddy = {
		enable = true;
		virtualHosts."sync.${cfg.domain}" = {
			extraConfig = ''
				reverse_proxy localhost:${toString cfg.ports.zeroCache} localhost:${toString cfg.ports.zeroViewSyncerB} {
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
