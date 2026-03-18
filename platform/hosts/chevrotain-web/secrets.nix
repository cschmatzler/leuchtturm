{...}: {
	sops.secrets.chevrotain-api-env = {
		sopsFile = ../../../secrets/chevrotain-api.env;
		format = "dotenv";
	};
}
