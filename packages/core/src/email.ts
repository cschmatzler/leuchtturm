import { Effect, Layer, Redacted, Schema, ServiceMap } from "effect";
import type { CreateEmailResponseSuccess } from "resend";
import { Resend } from "resend";

import { CoreConfig } from "@chevrotain/core/config";
import { makeRunPromise } from "@chevrotain/core/effect/run-service";

export interface SendParams {
	readonly from: string;
	readonly to: string;
	readonly subject: string;
	readonly html: string;
	readonly text: string;
}

export namespace Email {
	export class Error extends Schema.TaggedErrorClass<Error>()(
		"EmailError",
		{ message: Schema.String },
		{ httpApiStatus: 500 },
	) {}

	export interface Interface {
		readonly send: (params: SendParams) => Effect.Effect<CreateEmailResponseSuccess, Error>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Email") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const config = yield* CoreConfig;
			const resend = new Resend(Redacted.value(config.email.resendApiKey));

			yield* Effect.logInfo("Email initialized");

			const send = Effect.fn("Email.send")(function* (params: SendParams) {
				const result = yield* Effect.tryPromise({
					try: () => resend.emails.send(params),
					catch: (error) =>
						new Error({
							message: `Resend API request failed: ${error instanceof globalThis.Error ? error.message : String(error)}`,
						}),
				});

				if (result.error || !result.data) {
					return yield* new Error({
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
