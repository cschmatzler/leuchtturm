import { Config, Effect, Redacted } from "effect";

const loadSync = <A>(effect: Effect.Effect<A, unknown, never>): A => Effect.runSync(effect);

export const coreAuthConfig = loadSync(
	Effect.gen(function* () {
		const baseUrl = yield* Config.string("BASE_URL");
		const githubClientId = yield* Config.string("GITHUB_CLIENT_ID");
		const githubClientSecret = yield* Config.redacted("GITHUB_CLIENT_SECRET");

		return {
			baseUrl,
			githubClientId,
			githubClientSecret: Redacted.value(githubClientSecret),
		} as const;
	}),
);

export const coreBillingConfig = loadSync(
	Effect.gen(function* () {
		const accessToken = yield* Config.redacted("POLAR_ACCESS_TOKEN");
		const successUrl = yield* Config.string("POLAR_SUCCESS_URL");
		const webhookSecret = yield* Config.redacted("POLAR_WEBHOOK_SECRET");

		return {
			accessToken: Redacted.value(accessToken),
			successUrl,
			webhookSecret: Redacted.value(webhookSecret),
		} as const;
	}),
);

export const databaseUrl = loadSync(
	Effect.gen(function* () {
		const url = yield* Config.redacted("DATABASE_URL");
		return Redacted.value(url);
	}),
);
