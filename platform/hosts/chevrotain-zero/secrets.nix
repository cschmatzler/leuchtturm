{...}: {
	sops.secrets.zero-env = {
		sopsFile = ../../../secrets/zero.env;
		format = "dotenv";
	};
}
