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
	}: {
		_module.args.packages = inputs.self.packages.${pkgs.system};

		imports = [
			inputs.disko.nixosModules.disko
			inputs.sops-nix.nixosModules.sops
			(modulesPath + "/installer/scan/not-detected.nix")
			(modulesPath + "/profiles/qemu-guest.nix")
			../platform/hosts/chevrotain-zero/caddy.nix
			../platform/hosts/chevrotain-zero/zero.nix
			../platform/hosts/chevrotain-zero/disk-config.nix
			../platform/hosts/chevrotain-zero/hardware-configuration.nix
			../platform/hosts/chevrotain-zero/secrets.nix
		];

		networking.hostName = "chevrotain-zero";

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
