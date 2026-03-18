{...}: let
	cfg = import ../../../nix/config.nix;
in {
	services.caddy = {
		enable = true;
		virtualHosts."sync.${cfg.domain}" = {
			extraConfig = ''
				reverse_proxy localhost:${toString cfg.ports.zeroCache}
			'';
		};
	};

	networking.firewall.allowedTCPPorts = [80 443];
}
