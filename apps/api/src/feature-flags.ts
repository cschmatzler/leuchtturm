import { Cause, Context, Effect, Layer, Schema } from "effect";
import { PostHog } from "posthog-node/edge";

import { ApiConfig } from "@leuchtturm/api/config";

export namespace FeatureFlags {
	export class FeatureFlagsError extends Schema.TaggedErrorClass<FeatureFlagsError>()(
		"FeatureFlagsError",
		{ message: Schema.String },
		{ httpApiStatus: 500 },
	) {}

	export interface Interface {
		readonly isEnabled: (key: string, userId: string) => Effect.Effect<boolean, FeatureFlagsError>;
		readonly listForUser: (
			userId: string,
		) => Effect.Effect<Record<string, boolean>, FeatureFlagsError>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/FeatureFlags") {}

	const toEnabledRecord = (flags: Record<string, boolean | string>): Record<string, boolean> => {
		return Object.fromEntries(
			Object.entries(flags).map(([key, value]) => [
				key,
				value === true || typeof value === "string",
			]),
		);
	};

	export const layer = Layer.effect(Service)(
		Effect.sync(() => {
			const config = ApiConfig.posthog();
			const client = new PostHog(config.apiKey, {
				host: config.host,
			});
			return Service.of({
				isEnabled: (key, userId) =>
					Effect.gen(function* () {
						const enabled = yield* Effect.tryPromise({
							try: () =>
								client.isFeatureEnabled(key, userId, {
									sendFeatureFlagEvents: false,
								}),
							catch: (cause) => cause,
						}).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									return yield* Effect.fail(
										new FeatureFlagsError({
											message: `Failed to evaluate PostHog feature flag ${key} for user ${userId}`,
										}),
									);
								}),
							),
						);

						if (enabled === undefined) {
							return yield* new FeatureFlagsError({
								message: `PostHog returned no feature flag evaluation result for ${key} and user ${userId}`,
							});
						}

						return enabled;
					}),
				listForUser: (userId) =>
					Effect.tryPromise({
						try: async () => toEnabledRecord(await client.getAllFlags(userId)),
						catch: (cause) => cause,
					}).pipe(
						Effect.catchCause((cause) =>
							Effect.gen(function* () {
								yield* Effect.annotateCurrentSpan({
									"error.original_cause": Cause.pretty(cause),
								});
								return yield* Effect.fail(
									new FeatureFlagsError({
										message: `Failed to list PostHog feature flags for user ${userId}`,
									}),
								);
							}),
						),
					),
			});
		}),
	);

	export const defaultLayer = layer;
}
