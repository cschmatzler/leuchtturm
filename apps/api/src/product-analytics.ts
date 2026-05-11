import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { Posthog } from "@leuchtturm/api/posthog";

export namespace ProductAnalytics {
	export interface Interface {
		readonly capture: (
			distinctId: string,
			event: string,
			properties?: Record<string, unknown>,
		) => Effect.Effect<void, never, RequestContext.Service>;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/api/ProductAnalytics",
	) {}

	export const layer = Layer.effect(Service)(
		Effect.sync(() => {
			const client = Posthog.create();

			return Service.of({
				capture: (distinctId, event, properties = {}) =>
					Effect.gen(function* () {
						const context = yield* RequestContext.Service;

						yield* Effect.sync(() => {
							context.waitUntil(
								client.captureImmediate({
									distinctId,
									event,
									properties,
								}),
							);
						});
					}),
			});
		}),
	);
}
