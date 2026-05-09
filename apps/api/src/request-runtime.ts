import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";

export namespace RequestRuntime {
	export type WaitUntil = (promise: Promise<unknown>) => void;

	export interface Interface {
		readonly runAfterWaitUntil: (run: () => Promise<unknown>) => void;
		readonly waitUntil: WaitUntil;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/RequestRuntime",
	) {}

	export const metricRegistry = new Map<string, Metric.Metric.Metadata<any, any>>();

	const absorb = (promise: Promise<unknown>) =>
		promise.then(
			() => undefined,
			() => undefined,
		);

	const makeService = (waitUntil?: WaitUntil) => {
		const pending = new Set<Promise<void>>();

		const schedule = (promise: Promise<unknown>) => {
			const settled = absorb(promise);

			if (waitUntil) {
				waitUntil(settled);
				return;
			}

			void settled;
		};
		const waitForRegistered = async () => {
			while (pending.size > 0) {
				await Promise.allSettled(pending);
			}
		};
		const register = (promise: Promise<unknown>) => {
			let tracked: Promise<void>;
			tracked = absorb(promise).finally(() => pending.delete(tracked));
			pending.add(tracked);
			schedule(tracked);
		};

		return Service.of({
			runAfterWaitUntil: (run) => {
				schedule(waitForRegistered().then(run));
			},
			waitUntil: register,
		});
	};

	export const layer = Layer.succeed(Service, makeService());

	export const makeContext = (options: { readonly waitUntil?: WaitUntil }) =>
		Context.add(
			Context.add(Context.empty(), Metric.MetricRegistry, metricRegistry),
			Service,
			makeService(options.waitUntil),
		);

	export const registerPromise = (promise: Promise<unknown>) =>
		Effect.gen(function* () {
			const runtime = yield* Service;

			yield* Effect.sync(() => runtime.waitUntil(promise));
		});

	export const fork = Effect.fn("RequestRuntime.fork")(function* <A, E, R>(
		effect: Effect.Effect<A, E, R>,
	) {
		const fiber = yield* effect.pipe(Effect.forkDetach({ startImmediately: true }));

		yield* registerPromise(Fiber.await(fiber).pipe(Effect.asVoid, Effect.runPromise));
	});

	export const runAfterWaitUntil = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
		Effect.gen(function* () {
			const runtime = yield* Service;
			const context = yield* Effect.context<R>();

			yield* Effect.sync(() => {
				runtime.runAfterWaitUntil(() =>
					Effect.runPromise(
						effect.pipe(Effect.exit, Effect.asVoid, Effect.provideContext(context)),
					),
				);
			});
		});
}
