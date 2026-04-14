import { Effect, Layer, Schema, ServiceMap } from "effect";
import { PostHog } from "posthog-node";
import { Resource } from "sst";

export namespace FeatureFlags {
	const DefaultPostHogApiHost = "https://eu.i.posthog.com";

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

	export class Service extends ServiceMap.Service<Service, Interface>()(
		"@leuchtturm/FeatureFlags",
	) {}

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
				host: DefaultPostHogApiHost,
			});

			return Service.of({
				isEnabled: (key, userId) =>
					Effect.tryPromise({
						try: async () => {
							const enabled = await client.isFeatureEnabled(key, userId, {
								sendFeatureFlagEvents: false,
							});

							if (enabled === undefined) {
								throw new Error("PostHog returned no feature flag evaluation result");
							}

							return enabled;
						},
						catch: (error) =>
							new FeatureFlagsError({
								message: `Failed to evaluate PostHog feature flag ${key} for user ${userId}: ${String(error)}`,
							}),
					}),
				listForUser: (userId) =>
					Effect.tryPromise({
						try: async () => toEnabledRecord(await client.getAllFlags(userId)),
						catch: (error) =>
							new FeatureFlagsError({
								message: `Failed to list PostHog feature flags for user ${userId}: ${String(error)}`,
							}),
					}),
			});
		}),
	);

	export const defaultLayer = layer;
}
