import { env } from "cloudflare:workers";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EmailError, EmailProviderRequestError } from "@leuchtturm/email/errors";

export namespace Email {
	export interface SendParams {
		readonly from: string;
		readonly to: string;
		readonly subject: string;
		readonly html: string;
		readonly text: string;
	}

	export type Sender<Success, SendError> = (
		params: SendParams,
	) => Effect.Effect<Success, SendError>;

	export interface Interface {
		readonly send: (params: SendParams) => Effect.Effect<EmailSendResult, typeof EmailError.Type>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Email") {}

	export const layer = Layer.effect(Service)(
		Effect.sync(() => {
			const send = Effect.fn("Email.send")(function* (params: SendParams) {
				return yield* Effect.tryPromise({
					try: (): Promise<EmailSendResult> => env.EMAIL.send(params),
					catch: (cause) => cause,
				}).pipe(
					Effect.tapCause((cause) =>
						Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }),
					),
					Effect.mapError(() => new EmailProviderRequestError()),
				);
			});

			return Service.of({ send });
		}),
	);

	export const defaultLayer = layer;
}
