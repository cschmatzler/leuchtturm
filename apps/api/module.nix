{
	config,
	packages,
	...
}: let
	cfg = import ../../nix/config.nix;
in {
	systemd.services.one-api = {
		description = "Roasted API";
		after = ["network.target"];
		wantedBy = ["multi-user.target"];

		environment = {
			PORT = toString cfg.ports.api;
			NODE_ENV = "production";
			BASE_URL = "https://${cfg.domain}";
			OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:${toString cfg.ports.alloyOtlp}";
			OTEL_SERVICE_NAME = "one-api";
			OTEL_RESOURCE_ATTRIBUTES = "service.namespace=one,deployment.environment=production";
			CLICKHOUSE_URL = "http://127.0.0.1:${toString cfg.ports.clickhouse}";
		};

		serviceConfig = {
			Type = "exec";
			ExecStart = "${packages.api}/bin/one-api";
			EnvironmentFile = config.sops.secrets.one-api-env.path;
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
