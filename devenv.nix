{
	pkgs,
	config,
	...
}: {
	packages = [
		pkgs.aube
		pkgs.treefmt
		pkgs.cloudflared
	];

	# Languages
	# ---------

	languages.javascript.enable = true;
	languages.javascript.package = pkgs.nodejs_25;

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
		if [[ -f secrets/dev.env ]]; then
			echo "Loading secrets from secrets/dev.env..."
			set -a
			source <(sops -d secrets/dev.env)
			set +a
			echo "Secrets loaded"
		fi
	'';
}
