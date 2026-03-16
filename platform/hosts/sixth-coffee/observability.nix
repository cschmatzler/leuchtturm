{...}: {
	imports = [
		./observability/clickhouse.nix
		./observability/grafana.nix
		./observability/prometheus.nix
		./observability/loki.nix
		./observability/tempo.nix
		./observability/alloy.nix
	];
}
