import { Effect, Fiber, Layer, ServiceMap } from "effect";

export namespace BackgroundTasks {
	export interface Interface {
		readonly run: <A, E, R>(
			label: string,
			effect: Effect.Effect<A, E, R>,
		) => Effect.Effect<void, never, R>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()(
		"@leuchtturm/BackgroundTasks",
	) {}

	export const layer = (waitUntil?: (promise: Promise<unknown>) => void) =>
		Layer.succeed(
			Service,
			Service.of({
				run: (label, effect) =>
					Effect.gen(function* () {
						const fiber = yield* effect.pipe(
							Effect.tapError((error) => Effect.logError(`${label}: ${String(error)}`)),
							Effect.forkDetach({ startImmediately: true }),
						);

						const promise = Effect.runPromise(Fiber.await(fiber)).then(() => undefined);
						if (waitUntil) {
							waitUntil(promise);
						} else {
							void promise;
						}
					}),
			}),
		);
}
