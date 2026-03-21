import { Config, Effect, Redacted } from "effect";

export const CoreAuthConfig = Effect.gen(function* () {
	const baseUrl = yield* Config.string("BASE_URL");
	const authBaseUrl = yield* Config.string("AUTH_BASE_URL").pipe(Config.withDefault(baseUrl));
	const githubClientId = yield* Config.string("GITHUB_CLIENT_ID");
	const githubClientSecret = yield* Config.redacted("GITHUB_CLIENT_SECRET");

	return {
		baseUrl,
		authBaseUrl,
		githubClientId,
		githubClientSecret: Redacted.value(githubClientSecret),
	};
});

export const CoreBillingConfig = Effect.gen(function* () {
	const accessToken = yield* Config.redacted("POLAR_ACCESS_TOKEN");
	const successUrl = yield* Config.string("POLAR_SUCCESS_URL");
	const webhookSecret = yield* Config.redacted("POLAR_WEBHOOK_SECRET");

	return {
		accessToken: Redacted.value(accessToken),
		successUrl,
		webhookSecret: Redacted.value(webhookSecret),
	};
});
