import { Config as EffectConfig, Option, Schema } from "effect";

import { TrimmedNonEmptyString } from "@chevrotain/core/schema";

export const Config = EffectConfig.all({
	api: EffectConfig.all({
		baseUrl: EffectConfig.string("BASE_URL"),
		port: EffectConfig.number("PORT"),
	}),
	analytics: EffectConfig.all({
		clickhouseUrl: EffectConfig.string("CLICKHOUSE_URL"),
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
	observability: EffectConfig.all({
		deploymentEnvironment: EffectConfig.option(
			EffectConfig.schema(TrimmedNonEmptyString, "NODE_ENV"),
		).pipe(EffectConfig.map(Option.getOrUndefined)),
	}),
}).pipe(
	EffectConfig.map(({ api, analytics, auth, billing, email, observability }) => ({
		api,
		analytics,
		auth: {
			...auth,
			authBaseUrl: Option.getOrElse(auth.authBaseUrl, () => api.baseUrl),
		},
		billing,
		email,
		observability,
	})),
);
