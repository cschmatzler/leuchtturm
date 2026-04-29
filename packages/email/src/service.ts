import { env } from "cloudflare:workers";
import { Cause, Context, Effect, Layer, Schema } from "effect";

import { type EmailSendParams } from "@leuchtturm/email/shared";

export namespace Email {
	export class EmailProviderRequestError extends Schema.TaggedErrorClass<EmailProviderRequestError>()(
		"EmailProviderRequestError",
		{ message: Schema.String },
	) {
		constructor() {
			super({ message: "Cloudflare Email request failed" });
		}
	}

	export const EmailError = Schema.Union([EmailProviderRequestError]);

	export interface Interface {
		readonly send: (
			params: EmailSendParams,
		) => Effect.Effect<EmailSendResult, typeof EmailError.Type>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Email") {}

	export const layer = Layer.effect(Service)(
		Effect.sync(() => {
			const send = Effect.fn("Email.send")(function* (params: EmailSendParams) {
				return yield* Effect.tryPromise({
					try: (): Promise<EmailSendResult> => env.EMAIL.send(params),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(new EmailProviderRequestError());
						}),
					),
				);
			});

			return Service.of({ send });
		}),
	);

	export const defaultLayer = layer;
}
