import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";

export namespace RequestRuntime {
	export interface Interface {
		readonly register: (promise: Promise<unknown>) => void;
		readonly runAfterRegistered: (run: () => Promise<unknown>) => void;
		readonly waitUntil?: (promise: Promise<unknown>) => void;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/RequestRuntime",
	) {}

	export const metricRegistry = new Map<string, Metric.Metric.Metadata<any, any>>();

	const ignore = (promise: Promise<unknown>) =>
		promise.then(
			() => undefined,
			() => undefined,
		);

	const makeService = (waitUntil?: (promise: Promise<unknown>) => void) => {
		const pending = new Set<Promise<void>>();
		const defer = (promise: Promise<unknown>) => {
			const safe = ignore(promise);

			if (waitUntil) {
				waitUntil(safe);
				return;
			}

			void safe;
		};
		const drain = async () => {
			while (pending.size > 0) {
				await Promise.allSettled(pending);
			}
		};

		const register = (promise: Promise<unknown>) => {
			let tracked: Promise<void>;
			tracked = ignore(promise).finally(() => pending.delete(tracked));
			pending.add(tracked);
			defer(tracked);
		};

		return Service.of({
			register,
			runAfterRegistered: (run) => {
				defer(drain().then(run));
			},
			waitUntil: register,
		});
	};

	export const layer = Layer.succeed(Service, makeService());

	export const makeContext = (options: {
		readonly waitUntil?: (promise: Promise<unknown>) => void;
	}) =>
		Context.add(
			Context.add(Context.empty(), Metric.MetricRegistry, metricRegistry),
			Service,
			makeService(options.waitUntil),
		);

	export const register = (promise: Promise<unknown>) =>
		Effect.gen(function* () {
			(yield* Service).register(promise);
		});

	export const runAfterRegistered = (run: () => Promise<unknown>) =>
		Effect.gen(function* () {
			(yield* Service).runAfterRegistered(run);
		});
}
