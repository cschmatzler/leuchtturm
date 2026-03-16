{
	domain = "sixth.coffee";
	ports = {
		api = 3080;
		zeroCache = 3081;
		clickhouse = 8123;
		clickhouseNative = 9000;
		grafana = 3000;
		prometheus = 9090;
		loki = 3100;
		lokiGrpc = 9096;
		tempo = 3200;
		tempoOtlp = 4319;
		alloyOtlp = 4318;
		nodeExporter = 9100;
		postgresExporter = 9187;
	};
	zero = {
		image = "rocicorp/zero:0.25.11";
		appId = "one";
	};
}
