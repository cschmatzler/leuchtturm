import { Config, Option, Schema } from "effect";

const PolarServerConfig = Config.schema(
	Schema.Literals(["sandbox", "production"]),
	"POLAR_SERVER",
).pipe(Config.withDefault("sandbox"));

export const CoreConfig = Config.all({
	baseUrl: Config.string("BASE_URL"),
	auth: Config.all({
		authBaseUrl: Config.option(Config.string("AUTH_BASE_URL")),
		githubClientId: Config.string("GITHUB_CLIENT_ID"),
		githubClientSecret: Config.redacted("GITHUB_CLIENT_SECRET"),
	}),
	billing: Config.all({
		accessToken: Config.redacted("POLAR_ACCESS_TOKEN"),
		server: PolarServerConfig,
		successUrl: Config.string("POLAR_SUCCESS_URL"),
		webhookSecret: Config.redacted("POLAR_WEBHOOK_SECRET"),
	}),
}).pipe(
	Config.map(({ baseUrl, auth, billing }) => ({
		baseUrl,
		auth: {
			...auth,
			authBaseUrl: Option.getOrElse(auth.authBaseUrl, () => baseUrl),
		},
		billing,
	})),
);
