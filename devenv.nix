{
	pkgs,
	config,
	...
}: {
	# Use nixpkgs aube once > 1.10
	packages = [
		(pkgs.rustPlatform.buildRustPackage rec {
				pname = "aube";
				version = "1.12.0";

				src =
					pkgs.fetchCrate {
						inherit pname version;
						hash = "sha256-kfq1qRjSXtSyUK6z6UNQnQiDpDTrZ12kmm5wrReEe8Q=";
					};

				cargoHash = "sha256-ytJ6LIz165g7g+rwRZldIyDcTfwdiVGDrNPDAQyWwc0=";
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
