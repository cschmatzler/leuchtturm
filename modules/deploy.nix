{
	config,
	inputs,
	...
}: let
	mkNode = name: {
		hostname = "${name}.schmatzler.com";
		sshUser = "cschmatzler";
		profiles.system = {
			user = "root";
			path = inputs.deploy-rs.lib.x86_64-linux.activate.nixos config.flake.nixosConfigurations.${name};
		};
	};
in {
	flake.deploy.nodes = {
		chevrotain-web = mkNode "chevrotain-web";
		chevrotain-zero = mkNode "chevrotain-zero";
		chevrotain-postgres = mkNode "chevrotain-postgres";
		chevrotain-observability = mkNode "chevrotain-observability";
	};

	flake.checks.x86_64-linux = inputs.deploy-rs.lib.x86_64-linux.deployChecks config.flake.deploy;
}
