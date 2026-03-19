{
	config,
	packages,
	...
}: let
	cfg = import ../../nix/config.nix;
in {
	systemd.services.chevrotain-api = {
		description = "Roasted API";
		after = ["network.target"];
		wantedBy = ["multi-user.target"];

		environment = {
			PORT = toString cfg.ports.api;
			NODE_ENV = "production";
			BASE_URL = "https://${cfg.domain}";
			AUTH_BASE_URL = "https://api.${cfg.domain}";
			OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:${toString cfg.ports.alloyOtlp}";
			OTEL_SERVICE_NAME = "chevrotain-api";
			OTEL_RESOURCE_ATTRIBUTES = "service.namespace=chevrotain,deployment.environment=production";
			CLICKHOUSE_URL = "http://${cfg.hosts.observability}:${toString cfg.ports.clickhouse}";
		};

		serviceConfig = {
			Type = "exec";
			ExecStart = "${packages.api}/bin/chevrotain-api";
			EnvironmentFile = config.sops.secrets.chevrotain-api-env.path;
			Restart = "always";
			RestartSec = "5s";

			DynamicUser = true;
			NoNewPrivileges = true;
			PrivateTmp = true;
			ProtectHome = true;
			ProtectSystem = "strict";
		};
	};
}
