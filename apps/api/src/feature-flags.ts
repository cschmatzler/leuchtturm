import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { PostHog } from "posthog-node/edge";
import { Resource } from "sst";

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
			super({ ...params, message: `Feature flag provider request failed: ${params.operation}` });
		}
	}

	export class FeatureFlagEvaluationError extends Schema.TaggedErrorClass<FeatureFlagEvaluationError>()(
		"FeatureFlagEvaluationError",
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
				message: `Feature flag ${params.key} could not be evaluated for user ${params.userId}`,
			});
		}
	}

	export const FeatureFlagError = Schema.Union([
		FeatureFlagProviderRequestError,
		FeatureFlagEvaluationError,
	]);

	export interface Interface {
		readonly isEnabled: (
			key: string,
			userId: string,
		) => Effect.Effect<boolean, typeof FeatureFlagError.Type>;
		readonly listForUser: (
			userId: string,
		) => Effect.Effect<Record<string, boolean>, typeof FeatureFlagError.Type>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/FeatureFlags") {}

	export const layer = Layer.effect(Service)(
		Effect.sync(() => {
			const client = new PostHog(Resource.PostHogProjectApiKey.value, {
				host: Resource.PostHogHost.value,
			});

			return Service.of({
				isEnabled: (key, userId) =>
					Effect.gen(function* () {
						const result = yield* Effect.promise(() =>
							client.getFeatureFlagResult(key, userId, {
								sendFeatureFlagEvents: false,
							}),
						).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									return yield* Effect.fail(
										new FeatureFlagProviderRequestError({
											operation: `Evaluate feature flag ${key} for user ${userId}`,
										}),
									);
								}),
							),
						);

						if (result === undefined) {
							return yield* Effect.fail(new FeatureFlagEvaluationError({ key, userId }));
						}

						return result.enabled;
					}),
				listForUser: (userId) =>
					Effect.gen(function* () {
						const flags = yield* Effect.promise(() => client.evaluateFlags(userId)).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									return yield* Effect.fail(
										new FeatureFlagProviderRequestError({
											operation: `List feature flags for user ${userId}`,
										}),
									);
								}),
							),
						);

						return Object.fromEntries(flags.keys.map((key) => [key, flags.isEnabled(key)]));
					}),
			});
		}),
	);

	export const defaultLayer = layer;
}
