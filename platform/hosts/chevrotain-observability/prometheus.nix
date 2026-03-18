{...}: let
	cfg = import ../../../nix/config.nix;
in {
	services.prometheus = {
		enable = true;
		port = cfg.ports.prometheus;
		retentionTime = "30d";
		extraFlags = ["--web.enable-remote-write-receiver"];
		listenAddress = "0.0.0.0";
		scrapeConfigs = [
			# Self-scrape as a fallback — if Alloy goes down, Prometheus still
			# monitors itself so we can detect the outage.
			{
				job_name = "prometheus";
				static_configs = [
					{
						targets = ["127.0.0.1:${toString cfg.ports.prometheus}"];
					}
				];
				scrape_interval = "60s";
			}
		];
	};

	networking.firewall.interfaces."tailscale0".allowedTCPPorts = [
		cfg.ports.prometheus
	];
}
