declare module "cloudflare:workers" {
	export interface WorkflowEvent<Payload> {
		readonly payload: Payload;
	}

	export interface WorkflowStep {
		do<T>(name: string, callback: () => Promise<T>): Promise<T>;
		sleep(name: string, duration: string): Promise<void>;
	}

	export class WorkflowEntrypoint<Env = unknown> {
		protected readonly env: Env;
		constructor(ctx: unknown, env: Env);
		run(event: WorkflowEvent<unknown>, step: WorkflowStep): Promise<unknown>;
	}
}
