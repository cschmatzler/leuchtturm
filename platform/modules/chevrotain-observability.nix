{
	den,
	inputs,
	...
}: {
	den.aspects.chevrotain-observability.includes = [
		den.aspects.nixos-system
		den.aspects.core
		den.aspects.openssh
		den.aspects.fail2ban
		den.aspects.tailscale
		den.aspects.cschmatzler
		den.aspects.dev-tools
	];

	den.aspects.chevrotain-observability.nixos = {
		modulesPath,
		pkgs,
		...
	}: {
		imports = [
			inputs.disko.nixosModules.disko
			inputs.sops-nix.nixosModules.sops
			(modulesPath + "/installer/scan/not-detected.nix")
			(modulesPath + "/profiles/qemu-guest.nix")
			../hosts/chevrotain-observability/clickhouse.nix
			../hosts/chevrotain-observability/grafana.nix
			../hosts/chevrotain-observability/prometheus.nix
			../hosts/chevrotain-observability/loki.nix
			../hosts/chevrotain-observability/tempo.nix
			../hosts/chevrotain-observability/alloy.nix
			../hosts/chevrotain-observability/disk-config.nix
			../hosts/chevrotain-observability/hardware-configuration.nix
			../hosts/chevrotain-observability/secrets.nix
		];

		networking.hostName = "chevrotain-observability";

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
