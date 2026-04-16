import { Effect, Layer, ServiceMap } from "effect";

export interface GmailBootstrapWorkflowParams {
	readonly accountId: string;
	readonly accessToken: string;
}

export interface GmailBootstrapWorkflowBinding {
	create(options: {
		readonly id: string;
		readonly params: GmailBootstrapWorkflowParams;
	}): Promise<unknown>;
}

export function createGmailBootstrapWorkflowInstanceId(accountId: string): string {
	return `gmail-bootstrap-${accountId}-${crypto.randomUUID()}`;
}

export namespace GmailBootstrapWorkflowDispatcher {
	export interface Interface {
		readonly start: (params: GmailBootstrapWorkflowParams) => Effect.Effect<void, Error>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()(
		"@leuchtturm/GmailBootstrapWorkflowDispatcher",
	) {}

	export const layer = (binding: GmailBootstrapWorkflowBinding) =>
		Layer.succeed(
			Service,
			Service.of({
				start: (params) =>
					Effect.tryPromise({
						try: () =>
							binding.create({
								id: createGmailBootstrapWorkflowInstanceId(params.accountId),
								params,
							}),
						catch: (error) => (error instanceof Error ? error : new Error(String(error))),
					}).pipe(Effect.asVoid),
			}),
		);
}
