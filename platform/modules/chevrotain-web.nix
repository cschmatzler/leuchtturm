{
	den,
	inputs,
	...
}: {
	den.aspects.chevrotain-web.includes = [
		den.aspects.nixos-system
		den.aspects.core
		den.aspects.openssh
		den.aspects.fail2ban
		den.aspects.tailscale
		den.aspects.cschmatzler
		den.aspects.dev-tools
	];

	den.aspects.chevrotain-web.nixos = {
		config,
		modulesPath,
		pkgs,
		...
	}: let
		cfg = import ../nix/config.nix;
	in {
		_module.args.packages = inputs.self.packages.${pkgs.system};

		imports = [
			inputs.disko.nixosModules.disko
			inputs.sops-nix.nixosModules.sops
			(modulesPath + "/installer/scan/not-detected.nix")
			(modulesPath + "/profiles/qemu-guest.nix")
			../hosts/alloy-agent.nix
			../hosts/chevrotain-web/caddy.nix
			../hosts/chevrotain-web/disk-config.nix
			../hosts/chevrotain-web/hardware-configuration.nix
			../hosts/chevrotain-web/secrets.nix
			../../apps/api/module.nix
		];

		networking.hostName = "chevrotain-web";

		chevrotain.alloy.extraConfig = ''
			prometheus.scrape "chevrotain_api" {
				job_name        = "chevrotain/api"
				targets         = [{"__address__" = "127.0.0.1:${toString cfg.ports.api}"}]
				metrics_path    = "/api/metrics"
				scrape_interval = "15s"
				forward_to      = [prometheus.remote_write.default.receiver]
			}
		'';

		swapDevices = [
			{
				device = "/swapfile";
				size = 2048;
			}
		];

		boot.kernel.sysctl = {
			"vm.swappiness" = 1;
		};
	};
}
