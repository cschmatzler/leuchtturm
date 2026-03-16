{...}: {
	my.pgbackrest = {
		enable = true;
		secretFile = "/run/secrets/one-pgbackrest";
		s3 = {
			endpoint = "fsn1.your-objectstorage.com";
			bucket = "sixth-coffee-pgbackrest";
		};
	};
}
