import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
	FeatureFlagError,
	FeatureFlagEvaluationError,
	FeatureFlagProviderRequestError,
} from "@leuchtturm/api/feature-flags/errors";
import { PostHog } from "@leuchtturm/core/posthog";

export namespace FeatureFlags {
	export interface Interface {
		readonly isEnabled: (
			key: string,
			userId: string,
		) => Effect.Effect<boolean, typeof FeatureFlagError.Type>;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/api/FeatureFlags",
	) {}

	export const layer = Layer.effect(Service)(
		Effect.sync(() => {
			const client = PostHog.create();

			return Service.of({
				isEnabled: (key, userId) =>
					Effect.promise(() =>
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
						Effect.filterOrFail(
							(result) => result !== undefined,
							() => new FeatureFlagEvaluationError({ key, userId }),
						),
						Effect.map((result) => result.enabled),
					),
			});
		}),
	);

	export const defaultLayer = layer;
}
