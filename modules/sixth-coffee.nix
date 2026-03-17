{
	den,
	inputs,
	...
}: {
	den.aspects.sixth-coffee.includes = [
		den.aspects.nixos-system
		den.aspects.core
		den.aspects.openssh
		den.aspects.fail2ban
		den.aspects.tailscale
		den.aspects.cschmatzler
		den.aspects.dev-tools
	];

	den.aspects.sixth-coffee.nixos = {
		config,
		lib,
		modulesPath,
		pkgs,
		...
	}: {
		_module.args.packages = inputs.self.packages.${pkgs.system};

		imports = [
			inputs.disko.nixosModules.disko
			inputs.sops-nix.nixosModules.sops
			(modulesPath + "/installer/scan/not-detected.nix")
			(modulesPath + "/profiles/qemu-guest.nix")
			./_sixth-coffee/postgresql.nix
			./_sixth-coffee/pgbackrest.nix
			../platform/hosts/sixth-coffee/caddy.nix
			../platform/hosts/sixth-coffee/zero.nix
			../platform/hosts/sixth-coffee/observability.nix
			../platform/hosts/sixth-coffee/disk-config.nix
			../platform/hosts/sixth-coffee/hardware-configuration.nix
			../platform/hosts/sixth-coffee/pgbackrest.nix
			../platform/hosts/sixth-coffee/secrets.nix
			../apps/api/module.nix
		];

		networking.hostName = "sixth-coffee";

		virtualisation.docker = {
			enable = true;
			daemon.settings = {
				log-driver = "local";
			};
		};

		swapDevices = [
			{
				device = "/swapfile";
				size = 2048;
			}
		];

		boot.kernel.sysctl = {
			"vm.swappiness" = 1;
			"vm.dirty_background_ratio" = 3;
			"vm.dirty_ratio" = 10;
		};

		boot.kernelParams = ["transparent_hugepage=never"];

		systemd.services.postgresql.postStart =
			lib.mkAfter ''
				${config.services.postgresql.package}/bin/psql -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements"
				${config.services.postgresql.package}/bin/psql -d chevrotain -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements"
			'';

		systemd.services.postgresql-setup.postStart =
			lib.mkAfter ''
				${config.services.postgresql.package}/bin/psql -d chevrotain -c 'GRANT CONNECT ON DATABASE chevrotain TO grafana'
				${config.services.postgresql.package}/bin/psql -d chevrotain -c 'GRANT USAGE ON SCHEMA public TO grafana'
				${config.services.postgresql.package}/bin/psql -d chevrotain -c 'GRANT SELECT ON TABLE "user" TO grafana'
			'';

		services.postgresql = {
			ensureDatabases = ["chevrotain"];
			ensureUsers = [
				{
					name = "chevrotain";
					ensureDBOwnership = true;
					ensureClauses.superuser = true;
				}
				{
					name = "grafana";
					ensureClauses.login = true;
				}
			];

			authentication =
				lib.mkAfter ''
					host chevrotain grafana 127.0.0.1/32 trust
				'';

			settings = {
				shared_buffers = lib.mkForce "768MB";
				effective_cache_size = "2560MB";
				work_mem = "8MB";
				maintenance_work_mem = "128MB";
				wal_buffers = "-1";
				huge_pages = "off";

				max_worker_processes = 4;
				max_parallel_workers = 2;
				max_parallel_workers_per_gather = 1;
				max_parallel_maintenance_workers = 1;

				checkpoint_timeout = 900;
				checkpoint_completion_target = 0.9;
				max_wal_size = "2GB";
				min_wal_size = "256MB";
				wal_compression = "lz4";

				max_connections = 100;
				max_wal_senders = lib.mkForce 5;
				idle_in_transaction_session_timeout = "5min";

				random_page_cost = 1.1;
				effective_io_concurrency = 200;

				shared_preload_libraries = "pg_stat_statements";
				compute_query_id = "auto";
				"pg_stat_statements.track" = "all";
				"pg_stat_statements.max" = 10000;
				track_io_timing = "on";
				log_checkpoints = "on";
				log_lock_waits = "on";
				log_min_duration_statement = 500;
				log_autovacuum_min_duration = 1000;
			};
		};
	};
}
