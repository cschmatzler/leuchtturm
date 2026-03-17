{pkgs, ...}: let
	cfg = import ../../../../nix/config.nix;

	schema =
		pkgs.writeText "clickhouse-schema.sql" ''
			CREATE TABLE IF NOT EXISTS analytics_events (
				timestamp DateTime64(3, 'UTC'),
				event_id UUID,
				session_id String,
				user_id String,
				event_type LowCardinality(String),
				url String,
				referrer String,
				properties String DEFAULT '{}',
				ingested_at DateTime64(3) DEFAULT now64(3)
			) ENGINE = MergeTree()
			PARTITION BY toDate(timestamp)
			ORDER BY (event_type, user_id, timestamp)
			TTL toDate(timestamp) + INTERVAL 90 DAY DELETE
			SETTINGS index_granularity = 8192;

			CREATE TABLE IF NOT EXISTS error_events (
				timestamp DateTime64(3, 'UTC'),
				error_id UUID,
				source LowCardinality(String),
				user_id String DEFAULT ${"''"},
				session_id String DEFAULT ${"''"},
				error_type String,
				message String,
				stack_trace String DEFAULT ${"''"},
				url String DEFAULT ${"''"},
				method LowCardinality(String) DEFAULT ${"''"},
				status_code UInt16 DEFAULT 0,
				user_agent String DEFAULT ${"''"},
				properties String DEFAULT '{}'
			) ENGINE = MergeTree()
			PARTITION BY toDate(timestamp)
			ORDER BY (source, timestamp)
			TTL toDate(timestamp) + INTERVAL 90 DAY DELETE
			SETTINGS index_granularity = 8192;
		'';
in {
	services.clickhouse = {
		enable = true;
		serverConfig = {
			http_port = cfg.ports.clickhouse;
			tcp_port = cfg.ports.clickhouseNative;
			listen_host = "127.0.0.1";
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
}
