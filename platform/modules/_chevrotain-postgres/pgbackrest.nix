{
	config,
	lib,
	pkgs,
	...
}:
with lib; let
	cfg = config.my.pgbackrest;
in {
	options.my.pgbackrest = {
		enable = mkEnableOption "pgBackRest PostgreSQL backup";
		stanza =
			mkOption {
				type = types.str;
				default = "main";
			};
		secretFile =
			mkOption {
				type = types.path;
			};
		s3 =
			mkOption {
				type =
					types.submodule {
						options = {
							endpoint =
								mkOption {
									type = types.str;
									default = "s3.eu-central-003.backblazeb2.com";
								};
							bucket =
								mkOption {
									type = types.str;
								};
							region =
								mkOption {
									type = types.str;
									default = "eu-central-003";
								};
							path =
								mkOption {
									type = types.str;
									default = "/backups";
								};
						};
					};
				default = {};
			};
		retention =
			mkOption {
				type =
					types.submodule {
						options = {
							full =
								mkOption {
									type = types.int;
									default = 7;
								};
							diff =
								mkOption {
									type = types.int;
									default = 7;
								};
						};
					};
				default = {};
			};
		compression =
			mkOption {
				type =
					types.submodule {
						options = {
							type =
								mkOption {
									type = types.str;
									default = "zst";
								};
							level =
								mkOption {
									type = types.int;
									default = 3;
								};
						};
					};
				default = {};
			};
		processMax =
			mkOption {
				type = types.int;
				default = 2;
			};
		schedule =
			mkOption {
				type =
					types.submodule {
						options = {
							full =
								mkOption {
									type = types.str;
									default = "daily";
								};
							diff =
								mkOption {
									type = types.str;
									default = "hourly";
								};
						};
					};
				default = {};
			};
	};

	config =
		mkIf cfg.enable (
			let
				pgbackrestConfigPath = "/run/pgbackrest/pgbackrest.conf";
				pgbackrestBin = "${pkgs.pgbackrest}/bin/pgbackrest";
			in {
				environment.systemPackages = [
					pkgs.pgbackrest
				];

				systemd.services.pgbackrest-config = {
					description = "pgBackRest runtime config";
					before = [
						"postgresql.service"
						"pgbackrest-stanza-create.service"
						"pgbackrest-backup.service"
						"pgbackrest-backup-diff.service"
					];
					serviceConfig = {
						Type = "oneshot";
						User = "postgres";
						Group = "postgres";
						RemainAfterExit = true;
						RuntimeDirectory = "pgbackrest";
						RuntimeDirectoryMode = "0750";
					};
					script = ''
						set -eu
						umask 0077
						set -a
						source ${cfg.secretFile}
						set +a

						cat > ${pgbackrestConfigPath}.tmp <<EOF
						[global]
						repo1-type=s3
						repo1-s3-endpoint=${cfg.s3.endpoint}
						repo1-s3-bucket=${cfg.s3.bucket}
						repo1-s3-region=${cfg.s3.region}
						repo1-path=${cfg.s3.path}
						repo1-s3-key=$PGBACKREST_REPO1_S3_KEY
						repo1-s3-key-secret=$PGBACKREST_REPO1_S3_KEY_SECRET
						repo1-retention-full=${toString cfg.retention.full}
						repo1-retention-diff=${toString cfg.retention.diff}
						repo1-cipher-pass=$PGBACKREST_REPO1_CIPHER_PASS
						repo1-cipher-type=aes-256-cbc
						compress-type=${cfg.compression.type}
						compress-level=${toString cfg.compression.level}
						process-max=${toString cfg.processMax}
						log-level-console=info
						log-level-file=detail
						log-path=/var/log/pgbackrest
						spool-path=/var/spool/pgbackrest

						[${cfg.stanza}]
						pg1-path=/var/lib/postgresql/${config.services.postgresql.package.psqlSchema}
						pg1-user=postgres
						EOF

						mv ${pgbackrestConfigPath}.tmp ${pgbackrestConfigPath}
					'';
				};

				systemd.services.postgresql = {
					requires = ["pgbackrest-config.service"];
					after = ["pgbackrest-config.service"];
				};

				services.postgresql.settings = {
					archive_mode = "on";
					archive_command = "${pgbackrestBin} --config=${pgbackrestConfigPath} --stanza=${cfg.stanza} archive-push %p";
				};

				systemd.services.pgbackrest-stanza-create = {
					description = "pgBackRest Stanza Create";
					after = ["pgbackrest-config.service" "postgresql.service"];
					requires = ["pgbackrest-config.service" "postgresql.service"];
					serviceConfig = {
						Type = "oneshot";
						User = "postgres";
						RemainAfterExit = true;
					};
					script = ''
						${pgbackrestBin} --config=${pgbackrestConfigPath} --stanza=${cfg.stanza} stanza-create
					'';
				};

				systemd.services.pgbackrest-backup = {
					description = "pgBackRest Full Backup";
					after = ["pgbackrest-config.service" "postgresql.service" "pgbackrest-stanza-create.service"];
					requires = ["pgbackrest-config.service" "postgresql.service"];
					wants = ["pgbackrest-stanza-create.service"];
					serviceConfig = {
						Type = "oneshot";
						User = "postgres";
					};
					script = ''
						${pgbackrestBin} --config=${pgbackrestConfigPath} --stanza=${cfg.stanza} backup --type=full
					'';
				};

				systemd.timers.pgbackrest-backup = {
					wantedBy = ["timers.target"];
					timerConfig = {
						OnCalendar = cfg.schedule.full;
						Persistent = true;
						RandomizedDelaySec = "1h";
					};
				};

				systemd.services.pgbackrest-backup-diff = {
					description = "pgBackRest Differential Backup";
					after = ["pgbackrest-config.service" "postgresql.service" "pgbackrest-stanza-create.service"];
					requires = ["pgbackrest-config.service" "postgresql.service"];
					wants = ["pgbackrest-stanza-create.service"];
					serviceConfig = {
						Type = "oneshot";
						User = "postgres";
					};
					script = ''
						${pgbackrestBin} --config=${pgbackrestConfigPath} --stanza=${cfg.stanza} backup --type=diff
					'';
				};

				systemd.timers.pgbackrest-backup-diff = {
					wantedBy = ["timers.target"];
					timerConfig = {
						OnCalendar = cfg.schedule.diff;
						Persistent = true;
						RandomizedDelaySec = "5m";
					};
				};

				systemd.tmpfiles.rules = [
					"d /var/lib/pgbackrest 0750 postgres postgres -"
					"d /var/log/pgbackrest 0750 postgres postgres -"
					"d /var/spool/pgbackrest 0750 postgres postgres -"
				];
			}
		);
}
