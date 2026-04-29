import { Cause, Context, Effect, Layer, Schema } from "effect";
import { PostHog } from "posthog-node/edge";

import { ApiConfig } from "@leuchtturm/api/config";

export namespace FeatureFlags {
	export class FeatureFlagProviderRequestError extends Schema.TaggedErrorClass<FeatureFlagProviderRequestError>()(
		"FeatureFlagProviderRequestError",
		{
			operation: Schema.String,
			message: Schema.String,
		},
		{ httpApiStatus: 500 },
	) {
		constructor(params: { readonly operation: string }) {
			super({ ...params, message: `PostHog request failed: ${params.operation}` });
		}
	}

	export class FeatureFlagMissingEvaluationError extends Schema.TaggedErrorClass<FeatureFlagMissingEvaluationError>()(
		"FeatureFlagMissingEvaluationError",
		{
			key: Schema.String,
			userId: Schema.String,
			message: Schema.String,
		},
		{ httpApiStatus: 500 },
	) {
		constructor(params: { readonly key: string; readonly userId: string }) {
			super({
				...params,
				message: `PostHog returned no feature flag evaluation result for ${params.key} and user ${params.userId}`,
			});
		}
	}

	export const FeatureFlagsError = Schema.Union([
		FeatureFlagProviderRequestError,
		FeatureFlagMissingEvaluationError,
	]);

	export interface Interface {
		readonly isEnabled: (
			key: string,
			userId: string,
		) => Effect.Effect<boolean, typeof FeatureFlagsError.Type>;
		readonly listForUser: (
			userId: string,
		) => Effect.Effect<Record<string, boolean>, typeof FeatureFlagsError.Type>;
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
										new FeatureFlagProviderRequestError({
											operation: `Failed to evaluate feature flag ${key} for user ${userId}`,
										}),
									);
								}),
							),
						);

						if (enabled === undefined) {
							return yield* new FeatureFlagMissingEvaluationError({
								key,
								userId,
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
									new FeatureFlagProviderRequestError({
										operation: `Failed to list feature flags for user ${userId}`,
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
