import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Posthog } from "@leuchtturm/api/posthog";

export namespace ProductAnalytics {
	export interface Interface {
		readonly capture: (
			distinctId: string,
			event: string,
			properties?: Record<string, unknown>,
		) => Effect.Effect<void>;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/api/ProductAnalytics",
	) {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const posthog = yield* Posthog.Service;

			return Service.of({
				capture: posthog.capture,
			});
		}),
	);
}
