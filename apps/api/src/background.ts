import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { RequestRuntime } from "@leuchtturm/api/request-runtime";

export namespace BackgroundTasks {
	const run = Effect.fn("BackgroundTasks.run")(function* <A, E, R>(
		label: string,
		effect: Effect.Effect<A, E, R>,
	) {
		yield* RequestRuntime.fork(
			effect.pipe(
				Effect.withSpan(`background.${label}`, {
					attributes: { label },
					kind: "internal",
				}),
				Effect.tapError(() =>
					Effect.logError(`${label} failed`).pipe(Effect.annotateLogs({ label })),
				),
			),
		);
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
