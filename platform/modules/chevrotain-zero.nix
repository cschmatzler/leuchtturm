{
	den,
	inputs,
	...
}: {
	den.aspects.chevrotain-zero.includes = [
		den.aspects.nixos-system
		den.aspects.core
		den.aspects.openssh
		den.aspects.fail2ban
		den.aspects.tailscale
		den.aspects.cschmatzler
		den.aspects.dev-tools
	];

	den.aspects.chevrotain-zero.nixos = {
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
			../hosts/chevrotain-zero/caddy.nix
			../hosts/chevrotain-zero/zero.nix
			../hosts/chevrotain-zero/disk-config.nix
			../hosts/chevrotain-zero/hardware-configuration.nix
			../hosts/chevrotain-zero/secrets.nix
		];

		networking.hostName = "chevrotain-zero";

		networking.firewall.interfaces."docker0".allowedTCPPorts = [
			cfg.ports.alloyOtlp
		];

		virtualisation.docker = {
			enable = true;
			daemon.settings = {
				log-driver = "local";
			};
		};

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
