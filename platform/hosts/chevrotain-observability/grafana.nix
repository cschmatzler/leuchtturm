{
	config,
	lib,
	pkgs,
	...
}: let
	cfg = import ../../nix/config.nix;
in {
	services.grafana = {
		enable = true;
		declarativePlugins = with pkgs.grafanaPlugins; [
			grafana-clickhouse-datasource
		];
		settings = {
			server = {
				http_port = cfg.ports.grafana;
				http_addr = "127.0.0.1";
				domain = "chevrotain-observability";
			};
			security = {
				admin_password = "$__file{${config.sops.secrets.grafana-admin-password.path}}";
				secret_key = "$__file{${config.sops.secrets.grafana-secret-key.path}}";
				cookie_secure = true;
				strict_transport_security = true;
			};
		};
		provision.dashboards.settings.providers = [
			{
				name = "default";
				options.path = ./dashboards;
			}
		];
		provision.alerting.rules.settings = import ./alerting/rules.nix;
		provision.alerting.contactPoints.settings = import ./alerting/contact-points.nix;
		provision.alerting.policies.settings = import ./alerting/policies.nix;
		provision.datasources.settings.datasources = [
			{
				name = "Prometheus";
				uid = "prometheus";
				type = "prometheus";
				url = "http://127.0.0.1:${toString cfg.ports.prometheus}";
				isDefault = true;
			}
			{
				name = "Loki";
				uid = "loki";
				type = "loki";
				url = "http://127.0.0.1:${toString cfg.ports.loki}";
				jsonData = {
					derivedFields = [
						{
							name = "TraceID";
							matcherRegex = "trace(?:ID|Id|_id)[=\\\": ]+([0-9a-fA-F]+)";
							url = "$${__value.raw}";
							datasourceUid = "tempo";
							matcherType = "regex";
						}
					];
				};
			}
			{
				name = "Tempo";
				uid = "tempo";
				type = "tempo";
				url = "http://127.0.0.1:${toString cfg.ports.tempo}";
				jsonData = {
					httpMethod = "GET";
					streamingEnabled = {
						search = false;
						metrics = false;
					};
					tracesToLogsV2 = {
						datasourceUid = "loki";
						filterByTraceID = true;
						filterBySpanID = true;
					};
					tracesToMetrics = {
						datasourceUid = "prometheus";
					};
					nodeGraph = {
						enabled = true;
					};
					serviceMap = {
						datasourceUid = "prometheus";
					};
				};
			}
			{
				name = "PostgreSQL";
				uid = "postgres";
				type = "postgres";
				url = "${cfg.hosts.postgres}:5432";
				user = "grafana";
				jsonData = {
					database = "chevrotain";
					sslmode = "disable";
					postgresVersion = 1600;
				};
				secureJsonData = {
					password = "$__file{${config.sops.secrets.grafana-db-password.path}}";
				};
			}
			{
				name = "ClickHouse";
				uid = "clickhouse";
				type = "grafana-clickhouse-datasource";
				jsonData = {
					defaultDatabase = "default";
					protocol = "http";
					host = "127.0.0.1";
					server = "127.0.0.1";
					port = cfg.ports.clickhouse;
					username = "default";
					tlsSkipVerify = false;
				};
			}
		];
	};

	systemd.services.grafana = {
		after = [
			"tailscaled.service"
			"tailscaled-autoconnect.service"
		];
		wants = [
			"tailscaled.service"
			"tailscaled-autoconnect.service"
		];
		preStart =
			lib.mkBefore ''
				dns_name="$(${pkgs.tailscale}/bin/tailscale status --json | ${pkgs.jq}/bin/jq -r '.Self.DNSName | sub("\\.$"; "")')"

				if [[ -z "$dns_name" || "$dns_name" == "null" ]]; then
					echo "Unable to determine the Tailscale DNS name for Grafana" >&2
					exit 1
				fi

				cat > /run/grafana/tailscale.env <<-EOF
				GF_SERVER_DOMAIN=$dns_name
				GF_SERVER_ROOT_URL=https://$dns_name/
				EOF
			'';
		serviceConfig.EnvironmentFile = [
			"-/run/grafana/tailscale.env"
			config.sops.secrets.grafana-discord-webhook.path
		];
	};

	systemd.services.tailscale-serve-grafana = {
		description = "Expose Grafana over Tailscale HTTPS";
		after = [
			"grafana.service"
			"tailscaled.service"
			"tailscaled-autoconnect.service"
		];
		wants = [
			"grafana.service"
			"tailscaled.service"
			"tailscaled-autoconnect.service"
		];
		wantedBy = ["multi-user.target"];
		serviceConfig = {
			Type = "oneshot";
			RemainAfterExit = true;
			ExecStart = "${pkgs.tailscale}/bin/tailscale serve --bg --yes --https=443 http://127.0.0.1:${toString cfg.ports.grafana}";
			ExecStop = "-${pkgs.tailscale}/bin/tailscale serve --https=443 off";
		};
	};
}
