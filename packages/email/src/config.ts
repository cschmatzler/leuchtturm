import { Config, Effect, Redacted } from "effect";

export const resendApiKey = Effect.runSync(
	Effect.gen(function* () {
		const apiKey = yield* Config.redacted("RESEND_API_KEY");
		return Redacted.value(apiKey);
	}),
);
