{
	pkgs,
	config,
	...
}: {
	packages = [
		# Use nixpkgs aube once > 1.10
		(pkgs.rustPlatform.buildRustPackage rec {
				pname = "aube";
				version = "1.14.1";

				src =
					pkgs.fetchCrate {
						inherit pname version;
						hash = "sha256-SgLS8fMbtxULmnh4yRlMFOUTpGoqGa1B09nwr7ud7tU=";
					};

				cargoHash = "sha256-GPbo9OBeXL0RXc0zYDM4AIF2/RwxqKMPYM+5Nkf/P98=";
				nativeBuildInputs = [pkgs.cmake pkgs.pkg-config];
			})
		# Use nixpkgs fnox once it is packaged
		(pkgs.rustPlatform.buildRustPackage rec {
				pname = "fnox";
				version = "1.24.1";

				src =
					pkgs.fetchFromGitHub {
						owner = "jdx";
						repo = "fnox";
						rev = "v${version}";
						hash = "sha256-kmH0JLMCLj8xZt5zyajpLrLdW8HJfelh/d+b1ByFYRA=";
					};

				cargoHash = "sha256-EerAraPxLNx0rLOy7z8JQyhrqs13okAegh48In61YJQ=";
				nativeBuildInputs = [pkgs.perl pkgs.pkg-config];
				buildInputs = [pkgs.systemd];
			})
		pkgs.age
		pkgs.hurl
		pkgs.treefmt
		pkgs.cloudflared
	];

	# Languages
	# ---------

	languages.javascript.enable = true;

	# Environment
	# -----------

	env.SST_BUN_PATH = "${config.languages.javascript.bun.package}/bin/bun";

	# Scripts
	# -------

	scripts.ar.exec = ''
		aube run "$@"
	'';
}
