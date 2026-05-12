{
	pkgs,
	config,
	...
}: {
	packages = [
		pkgs.treefmt
		pkgs.cloudflared
	];

	# Languages
	# ---------

	languages.javascript.enable = true;
	languages.javascript.pnpm.enable = true;

	# Formatting
	# ----------

	treefmt = {
		enable = true;
		config = {
			programs = {
				alejandra.enable = true;
			};
			settings = {
				formatter = {
					vp-fmt = {
						command = "vp";
						includes = [
							"*.js"
							"*.jsx"
							"*.ts"
							"*.tsx"
							"*.mjs"
							"*.mts"
							"*.cjs"
							"*.cts"
							"*.css"
							"*.json"
							"*.jsonc"
							"*.md"
						];
						options = ["fmt" "--write"];
					};
				};
			};
		};
	};

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
