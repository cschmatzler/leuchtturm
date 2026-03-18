{config, ...}: let
	cfg = import ../../../nix/config.nix;
in {
	virtualisation.oci-containers = {
		backend = "docker";
		containers = {
			zero = {
				image = cfg.zero.image;
				extraOptions = [
					"--add-host=host.docker.internal:host-gateway"
					"--security-opt=no-new-privileges:true"
					"--cap-drop=ALL"
					"--read-only"
					"--tmpfs=/tmp:rw,noexec,nosuid,size=64m"
					"--health-cmd=wget --no-verbose --tries=1 --spider http://localhost:${toString cfg.ports.zeroCache}/ || exit 1"
					"--health-interval=30s"
					"--health-timeout=10s"
					"--health-retries=3"
					"--health-start-period=10s"
				];
				ports = ["${toString cfg.ports.zeroCache}:${toString cfg.ports.zeroCache}"];
				volumes = ["/data/zero-cache:/data"];
				environment = {
					LOG_LEVEL = "info";
					ZERO_APP_ID = cfg.zero.appId;
					ZERO_PORT = toString cfg.ports.zeroCache;
					ZERO_QUERY_FORWARD_COOKIES = "true";
					ZERO_MUTATE_FORWARD_COOKIES = "true";
					ZERO_QUERY_URL = "https://api.${cfg.domain}/api/query";
					ZERO_MUTATE_URL = "https://api.${cfg.domain}/api/mutate";
					ZERO_REPLICA_FILE = "/data/zero.db";
					OTEL_EXPORTER_OTLP_ENDPOINT = "http://${cfg.hosts.observability}:${toString cfg.ports.alloyOtlp}";
					OTEL_SERVICE_NAME = "zero-cache";
					OTEL_RESOURCE_ATTRIBUTES = "service.namespace=chevrotain,deployment.environment=production";
					OTEL_NODE_RESOURCE_DETECTORS = "env,host,os";
				};
				environmentFiles = [config.sops.secrets.zero-env.path];
			};
		};
	};

	systemd.tmpfiles.rules = ["d /data/zero-cache 0755 root root -"];
}
