{pkgs, ...}: let
	cfg = import ../../nix/config.nix;

	schema =
		pkgs.writeText "clickhouse-schema.sql" ''
			CREATE TABLE IF NOT EXISTS analytics_events (
				timestamp DateTime64(3, 'UTC'),
				eventId String,
				sessionId String,
				userId String,
				eventType LowCardinality(String),
				url String,
				referrer String,
				properties String DEFAULT '{}',
				ingestedAt DateTime64(3) DEFAULT now64(3)
			) ENGINE = MergeTree()
			PARTITION BY toDate(timestamp)
			ORDER BY (eventType, userId, timestamp)
			TTL toDate(timestamp) + INTERVAL 90 DAY DELETE
			SETTINGS index_granularity = 8192;

			CREATE TABLE IF NOT EXISTS error_events (
				timestamp DateTime64(3, 'UTC'),
				errorId String,
				source LowCardinality(String),
				userId String DEFAULT ${"''"},
				sessionId String DEFAULT ${"''"},
				errorType String,
				message String,
				stackTrace String DEFAULT ${"''"},
				url String DEFAULT ${"''"},
				method LowCardinality(String) DEFAULT ${"''"},
				statusCode UInt16 DEFAULT 0,
				userAgent String DEFAULT ${"''"},
				requestId String DEFAULT ${"''"},
				traceId String DEFAULT ${"''"},
				spanId String DEFAULT ${"''"},
				route String DEFAULT ${"''"},
				serviceNamespace LowCardinality(String) DEFAULT ${"''"},
				serviceName LowCardinality(String) DEFAULT ${"''"},
				deploymentEnvironment LowCardinality(String) DEFAULT ${"''"},
				properties String DEFAULT '{}'
			) ENGINE = MergeTree()
			PARTITION BY toDate(timestamp)
			ORDER BY (source, timestamp)
			TTL toDate(timestamp) + INTERVAL 90 DAY DELETE
			SETTINGS index_granularity = 8192;

			ALTER TABLE error_events ADD COLUMN IF NOT EXISTS requestId String DEFAULT ${"''"};
			ALTER TABLE error_events ADD COLUMN IF NOT EXISTS traceId String DEFAULT ${"''"};
			ALTER TABLE error_events ADD COLUMN IF NOT EXISTS spanId String DEFAULT ${"''"};
			ALTER TABLE error_events ADD COLUMN IF NOT EXISTS route String DEFAULT ${"''"};
			ALTER TABLE error_events ADD COLUMN IF NOT EXISTS serviceNamespace LowCardinality(String) DEFAULT ${"''"};
			ALTER TABLE error_events ADD COLUMN IF NOT EXISTS serviceName LowCardinality(String) DEFAULT ${"''"};
			ALTER TABLE error_events ADD COLUMN IF NOT EXISTS deploymentEnvironment LowCardinality(String) DEFAULT ${"''"};
		'';
in {
	services.clickhouse = {
		enable = true;
		serverConfig = {
			http_port = cfg.ports.clickhouse;
			tcp_port = cfg.ports.clickhouseNative;
			listen_host = "::";
			max_server_memory_usage = 1073741824; # 1GB
		};
		usersConfig = {
			profiles.default.max_memory_usage = 805306368; # 768MB
		};
	};

	systemd.services.clickhouse-schema-migration = {
		description = "ClickHouse analytics schema migration";
		after = ["clickhouse.service"];
		requires = ["clickhouse.service"];
		serviceConfig = {
			Type = "oneshot";
			RemainAfterExit = true;
			User = "clickhouse";
			ExecStart = "${pkgs.clickhouse}/bin/clickhouse-client --queries-file ${schema}";
		};
		wantedBy = ["multi-user.target"];
	};

	networking.firewall.interfaces."tailscale0".allowedTCPPorts = [
		cfg.ports.clickhouse
		cfg.ports.clickhouseNative
	];
}
