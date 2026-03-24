{...}: {
	my.pgbackrest = {
		enable = true;
		secretFile = "/run/secrets/chevrotain-pgbackrest";
		s3 = {
			endpoint = "nbg1.your-objectstorage.com";
			bucket = "chevrotain-pgbackrest";
		};
	};
}
