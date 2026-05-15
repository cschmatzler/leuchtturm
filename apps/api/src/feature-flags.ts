import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { FeatureFlagError } from "@leuchtturm/api/feature-flags/errors";
import { Posthog } from "@leuchtturm/api/posthog";

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
		Effect.gen(function* () {
			const posthog = yield* Posthog.Service;

			return Service.of({
				isEnabled: (key, userId) =>
					posthog
						.getFeatureFlagResult(key, userId, { sendFeatureFlagEvents: false })
						.pipe(Effect.map((result) => result.enabled)),
			});
		}),
	);

	export const defaultLayer = layer;
}
