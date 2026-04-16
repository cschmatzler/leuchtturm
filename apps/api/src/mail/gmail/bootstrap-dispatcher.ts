import { Effect, Layer, ServiceMap } from "effect";

export interface GmailBootstrapWorkflowParams {
	readonly accountId: string;
	readonly accessToken: string;
}

export interface GmailBootstrapWorkflowBinding {
	create(options: { readonly params: GmailBootstrapWorkflowParams }): Promise<unknown>;
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
						try: () => binding.create({ params }),
						catch: (error) => (error instanceof Error ? error : new Error(String(error))),
					}).pipe(Effect.asVoid),
			}),
		);
}
