{
	config,
	inputs,
	...
}: {
	flake.deploy.nodes.sixth-coffee = {
		hostname = "sixth-coffee";
		sshUser = "cschmatzler";
		profiles.system = {
			user = "root";
			path = inputs.deploy-rs.lib.x86_64-linux.activate.nixos config.flake.nixosConfigurations.sixth-coffee;
		};
	};

	flake.checks.x86_64-linux = inputs.deploy-rs.lib.x86_64-linux.deployChecks config.flake.deploy;
}
