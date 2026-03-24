let
	zeroViewSyncerCount = 2;
	zeroViewSyncerPrimaryPort = 3081;
	zeroReplicationManagerPort = 3082;
	zeroViewSyncerBasePort = 3083;
in {
	domain = "chevrotain.schmatzler.com";
	hosts = {
		web = "chevrotain-web";
		zero = "chevrotain-zero";
		postgres = "chevrotain-postgres";
		observability = "chevrotain-observability";
	};
	ports = {
		api = 3080;
		zeroCache = zeroViewSyncerPrimaryPort;
		zeroReplicationManager = zeroReplicationManagerPort;
		zeroViewSyncerBase = zeroViewSyncerBasePort;
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
		image = "rocicorp/zero:1.0.0";
		appId = "chevrotain";
		viewSyncerCount = zeroViewSyncerCount;
		viewSyncerPorts =
			builtins.genList (
				index:
					if index == 0
					then zeroViewSyncerPrimaryPort
					else zeroViewSyncerBasePort + index - 1
			)
			zeroViewSyncerCount;
	};
}
