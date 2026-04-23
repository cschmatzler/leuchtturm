import { Context, Effect, Layer } from "effect";
import { PostHog } from "posthog-node/edge";

import { ApiConfig } from "@leuchtturm/api/config";
import { RequestRuntime } from "@leuchtturm/api/request-runtime";

export namespace ProductAnalytics {
	const createClient = (waitUntil?: (promise: Promise<unknown>) => void) => {
		const config = ApiConfig.posthog();

		return new PostHog(config.apiKey, {
			host: config.host,
			waitUntil,
		});
	};

	export interface Interface {
		readonly capture: (
			distinctId: string,
			event: string,
			properties?: Record<string, unknown>,
		) => Effect.Effect<void, never, RequestRuntime.Service>;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/ProductAnalytics",
	) {}

	export const layer = Layer.succeed(
		Service,
		Service.of({
			capture: (distinctId, event, properties = {}) =>
				Effect.gen(function* () {
					const runtime = yield* RequestRuntime.Service;
					const client = createClient(runtime.waitUntil);

					yield* Effect.sync(() => {
						client.capture({
							distinctId,
							event,
							properties,
						});
					});
				}),
		}),
	);
}
