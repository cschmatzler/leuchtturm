{...}: {
	sops.secrets.roasted-pgbackrest = {
		sopsFile = ../../../secrets/roasted-pgbackrest;
		format = "binary";
		owner = "postgres";
		group = "postgres";
	};

	sops.secrets.roasted-api-env = {
		sopsFile = ../../../secrets/roasted-api.env;
		format = "dotenv";
	};

	sops.secrets.zero-env = {
		sopsFile = ../../../secrets/zero.env;
		format = "dotenv";
	};

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
}
