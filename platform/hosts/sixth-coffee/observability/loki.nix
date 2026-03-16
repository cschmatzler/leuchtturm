{...}: let
	cfg = import ../../../../nix/config.nix;
in {
	services.loki = {
		enable = true;
		configuration = {
			auth_enabled = false;
			server = {
				http_listen_port = cfg.ports.loki;
				http_listen_address = "127.0.0.1";
				grpc_listen_port = cfg.ports.lokiGrpc;
				grpc_listen_address = "127.0.0.1";
			};
			common = {
				ring = {
					instance_addr = "127.0.0.1";
					kvstore.store = "inmemory";
				};
				replication_factor = 1;
			};
			frontend_worker = {
				frontend_address = "127.0.0.1:${toString cfg.ports.lokiGrpc}";
			};
			schema_config = {
				configs = [
					{
						from = "2024-01-01";
						store = "tsdb";
						object_store = "filesystem";
						schema = "v13";
						index = {
							prefix = "index_";
							period = "24h";
						};
					}
				];
			};
			storage_config = {
				filesystem = {
					directory = "/var/lib/loki/chunks";
				};
				tsdb_shipper = {
					active_index_directory = "/var/lib/loki/tsdb-index";
					cache_location = "/var/lib/loki/tsdb-cache";
				};
			};
			compactor = {
				working_directory = "/var/lib/loki/compactor";
				delete_request_store = "filesystem";
				retention_enabled = true;
			};
			limits_config = {
				retention_period = "720h";
			};
		};
	};
}
