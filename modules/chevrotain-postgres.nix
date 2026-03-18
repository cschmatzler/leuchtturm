{
	den,
	inputs,
	...
}: {
	den.aspects.chevrotain-postgres.includes = [
		den.aspects.nixos-system
		den.aspects.core
		den.aspects.openssh
		den.aspects.fail2ban
		den.aspects.tailscale
		den.aspects.cschmatzler
		den.aspects.dev-tools
	];

	den.aspects.chevrotain-postgres.nixos = {
		config,
		lib,
		modulesPath,
		pkgs,
		...
	}: let
		cfg = import ../nix/config.nix;
	in {
		imports = [
			inputs.disko.nixosModules.disko
			inputs.sops-nix.nixosModules.sops
			(modulesPath + "/installer/scan/not-detected.nix")
			(modulesPath + "/profiles/qemu-guest.nix")
			../platform/hosts/alloy-agent.nix
			./_chevrotain-postgres/postgresql.nix
			./_chevrotain-postgres/pgbackrest.nix
			../platform/hosts/chevrotain-postgres/pgbackrest.nix
			../platform/hosts/chevrotain-postgres/disk-config.nix
			../platform/hosts/chevrotain-postgres/hardware-configuration.nix
			../platform/hosts/chevrotain-postgres/secrets.nix
		];

		networking.hostName = "chevrotain-postgres";

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
			'';

		systemd.services.postgresql-setup.postStart =
			lib.mkAfter ''
				${config.services.postgresql.package}/bin/psql -d chevrotain -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements"
				${config.services.postgresql.package}/bin/psql -d chevrotain -c 'GRANT CONNECT ON DATABASE chevrotain TO grafana'
				${config.services.postgresql.package}/bin/psql -d chevrotain -c 'GRANT USAGE ON SCHEMA public TO grafana'
				${config.services.postgresql.package}/bin/psql -d chevrotain -c 'DO $$ BEGIN GRANT SELECT ON TABLE "user" TO grafana; EXCEPTION WHEN undefined_table THEN NULL; END $$'
				${config.services.postgresql.package}/bin/psql -d chevrotain -c 'GRANT CONNECT ON DATABASE chevrotain TO prometheus'
				${config.services.postgresql.package}/bin/psql -d chevrotain -c 'GRANT pg_monitor TO prometheus'
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
				{
					name = "prometheus";
					ensureClauses.login = true;
				}
			];

			settings = {
				shared_buffers = lib.mkForce "1GB";
				effective_cache_size = "3GB";
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

				max_connections = 50;
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

		services.prometheus.exporters.postgres = {
			enable = true;
			port = cfg.ports.postgresExporter;
			dataSourceName = "user=prometheus host=/run/postgresql dbname=chevrotain";
			extraFlags = [
				"--collector.stat_statements"
			];
		};

		services.prometheus.exporters.node = {
			enable = true;
			port = cfg.ports.nodeExporter;
			enabledCollectors = ["systemd"];
		};

		networking.firewall.interfaces."tailscale0".allowedTCPPorts = [
			cfg.ports.postgresExporter
			cfg.ports.nodeExporter
		];
	};
}
