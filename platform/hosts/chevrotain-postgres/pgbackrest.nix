{...}: {
	my.pgbackrest = {
		enable = true;
		s3 = {
			endpoint = "nbg1.your-objectstorage.com";
			bucket = "chevrotain-pgbackrest";
		};
	};
}
