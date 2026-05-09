import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";

import { RequestContext } from "@leuchtturm/api/middleware/request-context";

export namespace BackgroundTasks {
	const run = Effect.fn("BackgroundTasks.run")(function* <A, E, R>(
		label: string,
		effect: Effect.Effect<A, E, R>,
	) {
		const context = yield* RequestContext.Service;
		const fiber = yield* effect.pipe(
			Effect.withSpan(`background.${label}`, {
				attributes: { label },
				kind: "internal",
			}),
			Effect.tapError(() =>
				Effect.logError(`${label} failed`).pipe(Effect.annotateLogs({ label })),
			),
			Effect.forkDetach({ startImmediately: true }),
		);

		yield* Effect.sync(() => {
			context.waitUntil(Fiber.await(fiber).pipe(Effect.asVoid, Effect.runPromise));
		});
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
