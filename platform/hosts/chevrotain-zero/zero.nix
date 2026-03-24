{config, ...}: let
	cfg = import ../../nix/config.nix;
	alphabet = "abcdefghijklmnopqrstuvwxyz";
	viewSyncerIndices = builtins.genList (index: index) cfg.zero.viewSyncerCount;
	indexToSuffix = index: let
		prefixIndex = builtins.div index 26;
		letterIndex = index - (prefixIndex * 26);
		letter = builtins.substring letterIndex 1 alphabet;
	in
		if index < 26
		then letter
		else "${indexToSuffix (prefixIndex - 1)}${letter}";
	viewSyncerName = index: "zero-view-syncer-${indexToSuffix index}";
	mkViewSyncerContainer = index: let
		name = viewSyncerName index;
		port = builtins.elemAt cfg.zero.viewSyncerPorts index;
	in {
		name = name;
		value = {
			image = cfg.zero.image;
			extraOptions = mkExtraOptions {port = 4848;};
			ports = ["127.0.0.1:${toString port}:4848"];
			volumes = ["/data/${name}:/data"];
			environment =
				mkCommonEnvironment name 4848
				// {
					ZERO_QUERY_FORWARD_COOKIES = "true";
					ZERO_MUTATE_FORWARD_COOKIES = "true";
					ZERO_QUERY_URL = "https://api.${cfg.domain}/api/query";
					ZERO_MUTATE_URL = "https://api.${cfg.domain}/api/mutate";
					ZERO_CHANGE_STREAMER_URI = zeroReplicationManagerUri;
				};
			environmentFiles = zeroEnvironmentFiles;
		};
	};
	mkViewSyncerSystemdService = index: let
		name = viewSyncerName index;
	in {
		name = "docker-${name}";
		value = {
			after = ["docker-zero-replication-manager.service"];
			requires = ["docker-zero-replication-manager.service"];
			partOf = ["docker-zero-replication-manager.service"];
		};
	};

	mkExtraOptions = {
		port,
		healthPath ? "/keepalive",
		healthInterval ? "30s",
	}: [
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
	zeroReplicationManagerUri = "http://host.docker.internal:${toString cfg.ports.zeroReplicationManager}";
in {
	assertions = [
		{
			assertion = cfg.zero.viewSyncerCount >= 1;
			message = "zero.viewSyncerCount must be at least 1";
		}
	];

	virtualisation.oci-containers = {
		backend = "docker";
		containers =
			{
				"zero-replication-manager" = {
					image = cfg.zero.image;
					extraOptions =
						mkExtraOptions {
							port = 4849;
							healthPath = "/";
							healthInterval = "5s";
						};
					ports = ["${toString cfg.ports.zeroReplicationManager}:4849"];
					volumes = ["/data/zero-replication-manager:/data"];
					environment =
						mkCommonEnvironment "zero-replication-manager" 4849
						// {
							ZERO_NUM_SYNC_WORKERS = "0";
						};
					environmentFiles = zeroEnvironmentFiles;
				};
			}
			// builtins.listToAttrs (map mkViewSyncerContainer viewSyncerIndices);
	};

	systemd.services = builtins.listToAttrs (map mkViewSyncerSystemdService viewSyncerIndices);

	systemd.tmpfiles.rules = ["d /data/zero-replication-manager 0755 root root -"] ++ map (index: "d /data/${viewSyncerName index} 0755 root root -") viewSyncerIndices;
}
