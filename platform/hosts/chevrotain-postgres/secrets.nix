{...}: {
	sops.secrets.chevrotain-pgbackrest = {
		sopsFile = ../../../secrets/chevrotain-pgbackrest;
		format = "binary";
		owner = "postgres";
		group = "postgres";
	};
}
