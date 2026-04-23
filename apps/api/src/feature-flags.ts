import { Context, Effect, Layer, Schema } from "effect";
import { PostHog } from "posthog-node/edge";
import { Resource } from "sst";

export namespace FeatureFlags {
	type Resources = {
		readonly PostHogHost?: {
			readonly value?: string;
		};
		readonly PostHogProjectApiKey?: {
			readonly value?: string;
		};
	};

	const getResources = () => Resource as unknown as Resources;

	const requireValue = (name: string, value: string | undefined) => {
		if (!value) {
			throw new Error(`Missing required config: ${name}`);
		}

		return value;
	};

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
			const resources = getResources();
			const apiKey = requireValue("PostHogProjectApiKey", resources.PostHogProjectApiKey?.value);
			const host = requireValue("PostHogHost", resources.PostHogHost?.value);

			const client = new PostHog(apiKey, {
				host,
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
								message: `Failed to evaluate PostHog feature flag ${key} for user ${userId}: ${(error as Error).message}`,
							}),
					}),
				listForUser: (userId) =>
					Effect.tryPromise({
						try: async () => toEnabledRecord(await client.getAllFlags(userId)),
						catch: (error) =>
							new FeatureFlagsError({
								message: `Failed to list PostHog feature flags for user ${userId}: ${(error as Error).message}`,
							}),
					}),
			});
		}),
	);

	export const defaultLayer = layer;
}
