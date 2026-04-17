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

	# Services
	# --------

	services.caddy = {
		enable = true;
		config = ''
			:34600 {
				handle /api/* {
					reverse_proxy localhost:3005
				}

				handle /sync/* {
					reverse_proxy localhost:4848
				}

				handle /* {
					reverse_proxy localhost:5173
				}
			}
		'';
	};

	services.postgres = {
		enable = true;
		listen_addresses = "*";
		port = 34601;
		settings = {
			wal_level = "logical";
		};
		initialScript = ''
			CREATE ROLE postgres WITH LOGIN PASSWORD 'postgres' SUPERUSER;
		'';
		initialDatabases = [
			{
				name = "leuchtturm";
				user = "postgres";
			}
		];
	};

	# Environment
	# -----------

	env.CFLAGS = "-D_GNU_SOURCE";
	env.PORT = "3005";
	env.SST_BUN_PATH = "${config.languages.javascript.bun.package}/bin/bun";

	# App
	env.BASE_URL = "http://localhost:34600";
	env.VITE_BASE_URL = "http://localhost:34600";
	env.VITE_API_URL = "http://localhost:34600";
	env.VITE_SYNC_URL = "http://localhost:34600/sync";

	# Database
	env.DATABASE_URL = "postgres://postgres:postgres@localhost:34601/leuchtturm";

	# Auth
	env.BETTER_AUTH_SECRET = "alberta-germany-gallons-outright-intubate-sake-verity";

	# Zero
	env.ZERO_APP_ID = "leuchtturm";
	env.ZERO_UPSTREAM_DB = config.env.DATABASE_URL;
	env.ZERO_REPLICA_FILE = "/tmp/zero.db";
	env.ZERO_QUERY_URL = "http://localhost:34600/api/query";
	env.ZERO_MUTATE_URL = "http://localhost:34600/api/mutate";
	env.ZERO_QUERY_FORWARD_COOKIES = "true";
	env.ZERO_MUTATE_FORWARD_COOKIES = "true";

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
