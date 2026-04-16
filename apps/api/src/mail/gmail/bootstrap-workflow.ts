import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import type { GmailBootstrapWorkflowParams } from "@leuchtturm/api/mail/gmail/bootstrap-dispatcher";
import { Database } from "@leuchtturm/core/drizzle";
import { Gmail } from "@leuchtturm/core/mail/gmail/workflows";

export interface GmailBootstrapWorkflowEnv {
	readonly HYPERDRIVE: {
		readonly connectionString: string;
	};
}

export class GmailBootstrapWorkflow extends WorkflowEntrypoint<GmailBootstrapWorkflowEnv> {
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
