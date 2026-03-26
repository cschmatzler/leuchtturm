{
	den,
	inputs,
	lib,
	...
}: let
	cloud-utils = inputs.nixpkgs.legacyPackages.x86_64-linux.cloud-utils;
in {
	options.flake = {
		deploy =
			lib.mkOption {
				type = lib.types.lazyAttrsOf lib.types.raw;
				default = {};
			};
		flakeModules =
			lib.mkOption {
				type = lib.types.lazyAttrsOf lib.types.raw;
				default = {};
			};
	};

	config = {
		systems = ["x86_64-linux"];

		den.default.nixos.system.stateVersion = "25.11";
		den.default.homeManager.home.stateVersion = "25.11";
		den.default.nixos.nixpkgs.overlays = [inputs.nixos-config.overlays.default];
		den.default.nixos.environment.systemPackages = [cloud-utils];

		den.default.nixos.security.sudo.extraRules = [
			{
				users = ["cschmatzler"];
				commands = [
					{
						command = "ALL";
						options = ["NOPASSWD"];
					}
				];
			}
		];

		den.default.includes = [
			den.provides.define-user
			den.provides.inputs'
		];

		den.schema.user.classes = lib.mkDefault ["homeManager"];
	};
}
