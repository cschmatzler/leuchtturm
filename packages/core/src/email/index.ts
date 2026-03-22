import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";
import type { CreateEmailResponseSuccess } from "resend";
import { Resend } from "resend";

import { makeRunPromise } from "@chevrotain/core/effect/run-service";
import { EmailError } from "@chevrotain/core/errors";

export interface SendParams {
	readonly from: string;
	readonly to: string;
	readonly subject: string;
	readonly html: string;
	readonly text: string;
}

export namespace Email {
	export interface Interface {
		readonly send: (params: SendParams) => Effect.Effect<CreateEmailResponseSuccess, EmailError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Email") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const resendApiKey = yield* Config.redacted("RESEND_API_KEY");
			const resend = new Resend(Redacted.value(resendApiKey));

			yield* Effect.logInfo("Email initialized");

			const send = Effect.fn("Email.send")(function* (params: SendParams) {
				const result = yield* Effect.tryPromise({
					try: () => resend.emails.send(params),
					catch: (error) =>
						new EmailError({
							message: `Resend API request failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				if (result.error || !result.data) {
					return yield* new EmailError({
						message: result.error?.message ?? "Email sent but received no response data",
					});
				}

				return result.data;
			});

			return Service.of({ send });
		}),
	);

	export const defaultLayer = layer;

	const runPromise = makeRunPromise(Service, defaultLayer);

	export async function send(params: SendParams) {
		return runPromise((service) => service.send(params));
	}
}
