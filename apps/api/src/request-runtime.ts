import * as OtelTracer from "@effect/opentelemetry/Tracer";
import type { Span } from "@opentelemetry/api";
import { Context, Effect, Layer, Tracer } from "effect";

export namespace RequestRuntime {
	export interface Interface {
		readonly waitUntil?: (promise: Promise<unknown>) => void;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/RequestRuntime",
	) {}

	export const layer = Layer.succeed(Service, Service.of({}));

	export const makeContext = (options: {
		readonly activeSpan?: Span | null;
		readonly waitUntil?: (promise: Promise<unknown>) => void;
	}) => {
		const activeSpan = options.activeSpan ?? undefined;
		const requestContext = Context.add(
			Context.empty(),
			Service,
			Service.of({ waitUntil: options.waitUntil }),
		);

		return activeSpan
			? Context.add(
					requestContext,
					Tracer.ParentSpan,
					OtelTracer.makeExternalSpan(activeSpan.spanContext()),
				)
			: requestContext;
	};

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
