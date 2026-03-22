import { Config, Option, Redacted } from "effect";

export const CoreAuthConfig = Config.all({
	baseUrl: Config.string("BASE_URL"),
	authBaseUrl: Config.option(Config.string("AUTH_BASE_URL")),
	githubClientId: Config.string("GITHUB_CLIENT_ID"),
	githubClientSecret: Config.redacted("GITHUB_CLIENT_SECRET"),
}).pipe(
	Config.map(({ baseUrl, authBaseUrl, githubClientId, githubClientSecret }) => ({
		baseUrl,
		authBaseUrl: Option.getOrElse(authBaseUrl, () => baseUrl),
		githubClientId,
		githubClientSecret: Redacted.value(githubClientSecret),
	})),
);

export const CoreBillingConfig = Config.all({
	accessToken: Config.redacted("POLAR_ACCESS_TOKEN"),
	successUrl: Config.string("POLAR_SUCCESS_URL"),
	webhookSecret: Config.redacted("POLAR_WEBHOOK_SECRET"),
}).pipe(
	Config.map(({ accessToken, successUrl, webhookSecret }) => ({
		accessToken: Redacted.value(accessToken),
		successUrl,
		webhookSecret: Redacted.value(webhookSecret),
	})),
);
