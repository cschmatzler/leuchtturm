import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";

export namespace RequestRuntime {
	export interface Interface {
		readonly waitUntil?: (promise: Promise<unknown>) => void;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/RequestRuntime",
	) {}

	export const metricRegistry = new Map<string, Metric.Metric.Metadata<any, any>>();

	export const layer = Layer.succeed(Service, Service.of({}));

	export const makeContext = (options: {
		readonly waitUntil?: (promise: Promise<unknown>) => void;
	}) =>
		Context.add(
			Context.add(Context.empty(), Metric.MetricRegistry, metricRegistry),
			Service,
			Service.of({ waitUntil: options.waitUntil }),
		);

	export const register = (promise: Promise<unknown>) =>
		Effect.gen(function* () {
			const runtime = yield* Service;

			yield* Effect.sync(() => {
				if (runtime.waitUntil) {
					runtime.waitUntil(promise);
					return;
				}

				void promise;
			});
		});
}
