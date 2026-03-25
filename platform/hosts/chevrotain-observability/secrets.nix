{...}: {
	sops.secrets.grafana-admin-password = {
		sopsFile = ../../../secrets/grafana-admin-password;
		format = "binary";
		owner = "grafana";
		group = "grafana";
	};

	sops.secrets.grafana-secret-key = {
		sopsFile = ../../../secrets/grafana-secret-key;
		format = "binary";
		owner = "grafana";
		group = "grafana";
	};

	sops.secrets.grafana-db-password = {
		sopsFile = ../../../secrets/grafana-db-password;
		format = "binary";
		owner = "grafana";
		group = "grafana";
	};

	sops.secrets.grafana-discord-webhook = {
		sopsFile = ../../../secrets/grafana-alerting.env;
		format = "dotenv";
		owner = "grafana";
		group = "grafana";
	};
}
