import { Cause, Context, Effect, Layer, Schema } from "effect";
import type { CreateEmailResponseSuccess } from "resend";
import { Resend } from "resend";
import { Resource } from "sst";

import type { SendParams } from "@leuchtturm/core/email/schema";

export namespace Email {
	export class EmailError extends Schema.TaggedErrorClass<EmailError>()(
		"EmailError",
		{ message: Schema.String },
		{ httpApiStatus: 500 },
	) {}

	export interface Interface {
		readonly send: (params: SendParams) => Effect.Effect<CreateEmailResponseSuccess, EmailError>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Email") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			yield* Effect.logInfo("Email initialized");

			const logAndFail = (message: string) => (cause: Cause.Cause<unknown>) =>
				Effect.gen(function* () {
					const prettyCause = Cause.pretty(cause);
					yield* Effect.annotateCurrentSpan({ "error.original_cause": prettyCause });
					yield* Effect.logError(message).pipe(Effect.annotateLogs({ cause: prettyCause }));

					return yield* Effect.fail(new EmailError({ message }));
				});

			const send = Effect.fn("Email.send")(function* (params: SendParams) {
				const result = yield* Effect.tryPromise({
					try: () => new Resend(Resource.ResendApiKey.value).emails.send(params),
					catch: (cause) => cause,
				}).pipe(Effect.catchCause(logAndFail("Resend API request failed")));

				if (result.error || !result.data) {
					if (result.error) {
						yield* Effect.logError("Resend API returned an error").pipe(
							Effect.annotateLogs({ error: result.error }),
						);
					}

					return yield* new EmailError({
						message: "Email sent but received no response data",
					});
				}

				return result.data;
			});

			return Service.of({ send });
		}),
	);

	export const defaultLayer = layer;
}
