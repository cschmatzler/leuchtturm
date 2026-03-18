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
			../platform/hosts/alloy-agent.nix
			../platform/hosts/chevrotain-web/caddy.nix
			../platform/hosts/chevrotain-web/disk-config.nix
			../platform/hosts/chevrotain-web/hardware-configuration.nix
			../platform/hosts/chevrotain-web/secrets.nix
			../apps/api/module.nix
		];

		networking.hostName = "chevrotain-web";

		services.prometheus.exporters.node = {
			enable = true;
			port = cfg.ports.nodeExporter;
			enabledCollectors = ["systemd"];
		};

		networking.firewall.interfaces."tailscale0".allowedTCPPorts = [
			cfg.ports.nodeExporter
		];

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
