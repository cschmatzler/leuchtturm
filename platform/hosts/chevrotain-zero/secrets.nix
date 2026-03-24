{...}: {
	sops.secrets.zero-env = {
		sopsFile = ../../../secrets/zero.env;
		format = "dotenv";
	};

	sops.secrets.zero-s3-env = {
		sopsFile = ../../../secrets/zero-s3.env;
		format = "dotenv";
	};
}
