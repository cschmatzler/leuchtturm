import { Cause, Context, Effect, Layer, Schema } from "effect";
import type { CreateEmailResponseSuccess } from "resend";
import { Resend } from "resend";
import { Resource } from "sst";

import { type EmailSendParams } from "@leuchtturm/email/shared";

export namespace Email {
	export class EmailProviderRequestError extends Schema.TaggedErrorClass<EmailProviderRequestError>()(
		"EmailProviderRequestError",
		{ message: Schema.String },
		{ httpApiStatus: 500 },
	) {}

	export class EmailMissingResponseDataError extends Schema.TaggedErrorClass<EmailMissingResponseDataError>()(
		"EmailMissingResponseDataError",
		{ message: Schema.String },
		{ httpApiStatus: 500 },
	) {}

	export const EmailError = Schema.Union([
		EmailProviderRequestError,
		EmailMissingResponseDataError,
	]);

	export interface Interface {
		readonly send: (
			params: EmailSendParams,
		) => Effect.Effect<CreateEmailResponseSuccess, typeof EmailError.Type>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Email") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			yield* Effect.logInfo("Email initialized");

			const send = Effect.fn("Email.send")(function* (params: EmailSendParams) {
				const result = yield* Effect.tryPromise({
					try: () => new Resend(Resource.ResendApiKey.value).emails.send(params),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new EmailProviderRequestError({ message: "Resend API request failed" }),
							);
						}),
					),
				);

				if (result.error || !result.data) {
					if (result.error) {
						yield* Effect.logError("Resend API returned an error").pipe(
							Effect.annotateLogs({ error: result.error }),
						);
					}

					return yield* new EmailMissingResponseDataError({
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
