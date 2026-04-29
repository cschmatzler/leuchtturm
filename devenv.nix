{
	pkgs,
	config,
	...
}: {
	packages = [
		pkgs.bash
		pkgs.nufmt
		pkgs.nushell
		pkgs.readline
		pkgs.treefmt
		pkgs.wrangler
	];

	# Languages
	# ---------

	languages.javascript.enable = true;
	languages.javascript.package = pkgs.nodejs_25;
	languages.javascript.pnpm.enable = true;
	languages.javascript.pnpm.package = pkgs.pnpm_10;
	languages.javascript.bun.enable = true;
	# Required for Zero native extension
	languages.python.enable = true;
	languages.cplusplus.enable = true;

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

	env.CFLAGS = "-D_GNU_SOURCE";
	env.PORT = "3005";
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
