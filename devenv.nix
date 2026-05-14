{
	pkgs,
	config,
	...
}: {
	packages = [
		# Use nixpkgs aube once > 1.10
		(pkgs.rustPlatform.buildRustPackage rec {
				pname = "aube";
				version = "1.13.1";

				src =
					pkgs.fetchCrate {
						inherit pname version;
						hash = "sha256-9OI1O5JnT4uY4vonosi/TJBhFIl8nhwFWeJ9TU0Y08Y=";
					};

				cargoHash = "sha256-EA+QS5HT42jlcH+7WVj9+0GY9Mjry7mEjRBbOshwcws=";
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
