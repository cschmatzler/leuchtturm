import { Context, Effect, Layer, Schema } from "effect";
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

			const fail = (message: string) => () =>
				new EmailError({
					message,
				});

			const send = Effect.fn("Email.send")(function* (params: SendParams) {
				const result = yield* Effect.tryPromise({
					try: () => new Resend(Resource.ResendApiKey.value).emails.send(params),
					catch: fail("Resend API request failed"),
				});

				if (result.error || !result.data) {
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
