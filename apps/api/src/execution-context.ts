import * as Context from "effect/Context";

export namespace ExecutionContext {
	export interface Interface {
		readonly waitUntil: (promise: Promise<unknown>) => void;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/api/ExecutionContext",
	) {}

	export function make(executionContext: Interface) {
		return Context.make(
			Service,
			Service.of({
				waitUntil: executionContext.waitUntil.bind(executionContext),
			}),
		);
	}
}
