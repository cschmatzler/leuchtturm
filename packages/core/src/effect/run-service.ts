import { Effect, Layer, ManagedRuntime, ServiceMap } from "effect";

export const memoMap = Layer.makeMemoMapUnsafe();

export function makeRuntime<R, S, E>(service: ServiceMap.Service<R, S>, layer: Layer.Layer<R, E>) {
	let runtime: ManagedRuntime.ManagedRuntime<R, E> | undefined;
	const getRuntime = () => (runtime ??= ManagedRuntime.make(layer, { memoMap }));

	return {
		runSync: <A, Err>(fn: (service: S) => Effect.Effect<A, Err, R>) =>
			getRuntime().runSync(service.use(fn)),
		runPromiseExit: <A, Err>(
			fn: (service: S) => Effect.Effect<A, Err, R>,
			options?: Effect.RunOptions,
		) => getRuntime().runPromiseExit(service.use(fn), options),
		runPromise: <A, Err>(
			fn: (service: S) => Effect.Effect<A, Err, R>,
			options?: Effect.RunOptions,
		) => getRuntime().runPromise(service.use(fn), options),
		runFork: <A, Err>(fn: (service: S) => Effect.Effect<A, Err, R>, options?: Effect.RunOptions) =>
			getRuntime().runFork(service.use(fn), options),
		runCallback: <A, Err>(
			fn: (service: S) => Effect.Effect<A, Err, R>,
			options?: Parameters<ManagedRuntime.ManagedRuntime<R, E>["runCallback"]>[1],
		) => getRuntime().runCallback(service.use(fn), options),
	};
}
