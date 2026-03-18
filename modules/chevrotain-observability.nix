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
			../platform/hosts/chevrotain-observability/clickhouse.nix
			../platform/hosts/chevrotain-observability/grafana.nix
			../platform/hosts/chevrotain-observability/prometheus.nix
			../platform/hosts/chevrotain-observability/loki.nix
			../platform/hosts/chevrotain-observability/tempo.nix
			../platform/hosts/chevrotain-observability/alloy.nix
			../platform/hosts/chevrotain-observability/disk-config.nix
			../platform/hosts/chevrotain-observability/hardware-configuration.nix
			../platform/hosts/chevrotain-observability/secrets.nix
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
