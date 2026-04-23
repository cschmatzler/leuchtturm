import { Context, Effect, Fiber, Layer } from "effect";

import { Observability } from "@leuchtturm/api/observability";
import { RequestRuntime } from "@leuchtturm/api/request-runtime";

export namespace BackgroundTasks {
	const run = Effect.fn("BackgroundTasks.run")(function* <A, E, R>(
		label: string,
		effect: Effect.Effect<A, E, R>,
	) {
		const fiber = yield* effect.pipe(
			Effect.withSpan(`background.${label}`, {
				attributes: { label },
				kind: "internal",
			}),
			Effect.tapError(() => Observability.logError(`${label} failed`, { label })),
			Effect.forkDetach({ startImmediately: true }),
		);

		yield* RequestRuntime.register(Effect.runPromise(Fiber.await(fiber)).then(() => undefined));
	});

	export interface Interface {
		readonly run: typeof run;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/BackgroundTasks",
	) {}

	export const layer = Layer.succeed(
		Service,
		Service.of({
			run,
		}),
	);
}
