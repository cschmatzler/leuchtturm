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
			const client = new PostHog(Resource.PostHogProjectApiKey.value, {
				host: Resource.PostHogHost.value,
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
											operation: `Evaluate feature flag ${key} for user ${userId}`,
										}),
									);
								}),
							),
						);

						if (enabled === undefined) {
							return yield* Effect.fail(new FeatureFlagEvaluationError({ key, userId }));
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
										operation: `List feature flags for user ${userId}`,
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
