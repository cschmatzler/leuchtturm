{...}: let
	cfg = import ../../nix/config.nix;
in {
	services.prometheus = {
		enable = true;
		port = cfg.ports.prometheus;
		retentionTime = "30d";
		extraFlags = ["--web.enable-remote-write-receiver"];
		listenAddress = "0.0.0.0";
		# All scraping is handled by Alloy. No native scrapeConfigs to avoid
		# duplicate samples — Prometheus rejects remote_write batches that
		# contain samples already written by a native scrape job.
		scrapeConfigs = [];
	};

	networking.firewall.interfaces."tailscale0".allowedTCPPorts = [
		cfg.ports.prometheus
	];
}
