{config, ...}: let
	cfg = import ../../nix/config.nix;

	mkExtraOptions = {port, healthPath ? "/keepalive", healthInterval ? "30s"}: [
		"--add-host=host.docker.internal:host-gateway"
		"--security-opt=no-new-privileges:true"
		"--cap-drop=ALL"
		"--read-only"
		"--tmpfs=/tmp:rw,noexec,nosuid,size=64m"
		"--health-cmd=wget --no-verbose --tries=1 --spider http://localhost:${toString port}${healthPath} || exit 1"
		"--health-interval=${healthInterval}"
		"--health-timeout=10s"
		"--health-retries=3"
		"--health-start-period=10s"
	];

	mkCommonEnvironment = serviceName: port: {
		LOG_LEVEL = "info";
		ZERO_APP_ID = cfg.zero.appId;
		ZERO_PORT = toString port;
		ZERO_REPLICA_FILE = "/data/replica.db";
		OTEL_EXPORTER_OTLP_ENDPOINT = "http://host.docker.internal:${toString cfg.ports.alloyOtlp}";
		OTEL_SERVICE_NAME = serviceName;
		OTEL_RESOURCE_ATTRIBUTES = "service.namespace=chevrotain,deployment.environment=production";
		OTEL_NODE_RESOURCE_DETECTORS = "env,host,os";
	};

	zeroEnvironmentFiles = [
		config.sops.secrets.zero-env.path
		config.sops.secrets.zero-s3-env.path
	];
in {
	virtualisation.oci-containers = {
		backend = "docker";
		containers = {
			"zero-replication-manager" = {
				image = cfg.zero.image;
				extraOptions = mkExtraOptions {
					port = 4849;
					healthPath = "/";
					healthInterval = "5s";
				};
				volumes = ["/data/zero-replication-manager:/data"];
				environment =
					mkCommonEnvironment "zero-replication-manager" 4849
					// {
						ZERO_NUM_SYNC_WORKERS = "0";
					};
				environmentFiles = zeroEnvironmentFiles;
			};

			"zero-view-syncer-a" = {
				image = cfg.zero.image;
				extraOptions = (mkExtraOptions {port = 4848;}) ++ ["--link=zero-replication-manager:zero-replication-manager"];
				ports = ["127.0.0.1:${toString cfg.ports.zeroCache}:4848"];
				volumes = ["/data/zero-view-syncer-a:/data"];
					environment =
						mkCommonEnvironment "zero-view-syncer-a" 4848
						// {
							ZERO_QUERY_FORWARD_COOKIES = "true";
							ZERO_MUTATE_FORWARD_COOKIES = "true";
							ZERO_QUERY_URL = "https://api.${cfg.domain}/api/query";
							ZERO_MUTATE_URL = "https://api.${cfg.domain}/api/mutate";
							ZERO_CHANGE_STREAMER_URI = "http://zero-replication-manager:4849";
						};
				environmentFiles = zeroEnvironmentFiles;
			};

			"zero-view-syncer-b" = {
				image = cfg.zero.image;
				extraOptions = (mkExtraOptions {port = 4848;}) ++ ["--link=zero-replication-manager:zero-replication-manager"];
				ports = ["127.0.0.1:${toString cfg.ports.zeroViewSyncerB}:4848"];
				volumes = ["/data/zero-view-syncer-b:/data"];
					environment =
						mkCommonEnvironment "zero-view-syncer-b" 4848
						// {
							ZERO_QUERY_FORWARD_COOKIES = "true";
							ZERO_MUTATE_FORWARD_COOKIES = "true";
							ZERO_QUERY_URL = "https://api.${cfg.domain}/api/query";
							ZERO_MUTATE_URL = "https://api.${cfg.domain}/api/mutate";
							ZERO_CHANGE_STREAMER_URI = "http://zero-replication-manager:4849";
						};
				environmentFiles = zeroEnvironmentFiles;
			};
		};
	};

	systemd.services.docker-zero-view-syncer-a = {
		after = ["docker-zero-replication-manager.service"];
	};

	systemd.services.docker-zero-view-syncer-b = {
		after = ["docker-zero-replication-manager.service"];
	};

	systemd.tmpfiles.rules = [
		"d /data/zero-replication-manager 0755 root root -"
		"d /data/zero-view-syncer-a 0755 root root -"
		"d /data/zero-view-syncer-b 0755 root root -"
	];
}
