{...}: let
	sopsFile = ../../../secrets/chevrotain-pgbackrest;
in {
	sops.secrets = {
		PGBACKREST_REPO1_S3_KEY = {
			inherit sopsFile;
			format = "json";
			owner = "postgres";
			group = "postgres";
		};
		PGBACKREST_REPO1_S3_KEY_SECRET = {
			inherit sopsFile;
			format = "json";
			owner = "postgres";
			group = "postgres";
		};
		PGBACKREST_REPO1_CIPHER_PASS = {
			inherit sopsFile;
			format = "json";
			owner = "postgres";
			group = "postgres";
		};
	};
}
