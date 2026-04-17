import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { fromCloudflareEnv } from "sst/resource/cloudflare";

import { Database } from "@leuchtturm/core/drizzle";
import { Gmail } from "@leuchtturm/core/mail/gmail/workflows";

export interface GmailBootstrapWorkflowParams {
	readonly accountId: string;
	readonly accessToken: string;
}

export interface GmailBootstrapWorkflowEnv {
	readonly HYPERDRIVE: {
		readonly connectionString: string;
	};
}

type WorkflowContext = ConstructorParameters<typeof WorkflowEntrypoint>[0];

export class GmailBootstrapWorkflow extends WorkflowEntrypoint<GmailBootstrapWorkflowEnv> {
	constructor(ctx: WorkflowContext, env: GmailBootstrapWorkflowEnv) {
		fromCloudflareEnv(env);
		super(ctx, env);
	}

	override async run(event: WorkflowEvent<GmailBootstrapWorkflowParams>, step: WorkflowStep) {
		const payload = event.payload;

		await step.do("bootstrap gmail account", async () => {
			await Effect.runPromise(
				Gmail.BootstrapWorkflow.execute({
					accountId: payload.accountId,
					accessToken: payload.accessToken,
				}).pipe(
					Effect.provide(
						Gmail.defaultLayer.pipe(
							Layer.provideMerge(Database.layer(this.env.HYPERDRIVE.connectionString)),
						),
					),
				),
			);

			return {
				accountId: payload.accountId,
				success: true as const,
			};
		});
	}
}

export default {};
