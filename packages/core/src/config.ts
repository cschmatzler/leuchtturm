import { Config as EffectConfig, Option, Schema } from "effect";

export const Config = EffectConfig.all({
	api: EffectConfig.all({
		baseUrl: EffectConfig.string("BASE_URL"),
		port: EffectConfig.number("PORT").pipe(EffectConfig.withDefault(3005)),
	}),
	auth: EffectConfig.all({
		authBaseUrl: EffectConfig.option(EffectConfig.string("AUTH_BASE_URL")),
		githubClientId: EffectConfig.string("GITHUB_CLIENT_ID"),
		githubClientSecret: EffectConfig.redacted("GITHUB_CLIENT_SECRET"),
	}),
	billing: EffectConfig.all({
		accessToken: EffectConfig.redacted("POLAR_ACCESS_TOKEN"),
		server: EffectConfig.schema(Schema.Literals(["sandbox", "production"]), "POLAR_SERVER").pipe(
			EffectConfig.withDefault("sandbox"),
		),
		successUrl: EffectConfig.string("POLAR_SUCCESS_URL"),
		webhookSecret: EffectConfig.redacted("POLAR_WEBHOOK_SECRET"),
	}),
	email: EffectConfig.all({
		resendApiKey: EffectConfig.redacted("RESEND_API_KEY"),
	}),
}).pipe(
	EffectConfig.map(({ api, auth, billing, email }) => ({
		api,
		auth: {
			...auth,
			authBaseUrl: Option.getOrElse(auth.authBaseUrl, () => api.baseUrl),
		},
		billing,
		email,
	})),
);
