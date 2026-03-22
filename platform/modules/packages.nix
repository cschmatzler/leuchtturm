{...}: {
	perSystem = {pkgs, ...}: {
		packages = {
			api = pkgs.callPackage ../../apps/api/package.nix {};
			web = pkgs.callPackage ../../apps/web/package.nix {};
		};
	};
}
