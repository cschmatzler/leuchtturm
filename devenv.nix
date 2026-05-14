{
	pkgs,
	config,
	...
}: {
	# Use nixpkgs aube once > 1.10
	packages = [
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

	# Shell
	# -----

	enterShell = ''
		PATH=":''${PATH}:"
		PATH="''${PATH//:node_modules\/.bin:/:}"
		PATH="''${PATH#:}"
		PATH="''${PATH%:}"
		export PATH

		if [[ -f secrets/dev.env ]]; then
			echo "Loading secrets from secrets/dev.env..."
			set -a
			source <(sops -d secrets/dev.env)
			set +a
			echo "Secrets loaded"
		fi
	'';
}
