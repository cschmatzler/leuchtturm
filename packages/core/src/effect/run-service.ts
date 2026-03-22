import { Effect, Layer, ManagedRuntime, ServiceMap } from "effect";

export const memoMap = Layer.makeMemoMapUnsafe();

export function makeRunPromise<R, S, E>(
	service: ServiceMap.Service<R, S>,
	layer: Layer.Layer<R, E>,
) {
	let runtime: ManagedRuntime.ManagedRuntime<R, E> | undefined;

	return <A, Err>(
		fn: (service: S) => Effect.Effect<A, Err, R>,
		options?: Parameters<ManagedRuntime.ManagedRuntime<R, E>["runPromise"]>[1],
	) => {
		runtime ??= ManagedRuntime.make(layer, { memoMap });
		return runtime.runPromise(service.use(fn), options);
	};
}
