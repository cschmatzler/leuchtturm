import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";
import { Resend } from "resend";
import type { CreateEmailResponseSuccess } from "resend";

import { EmailError } from "@chevrotain/core/errors";

export interface EmailServiceShape {
	readonly send: (params: {
		from: string;
		to: string;
		subject: string;
		html: string;
		text: string;
	}) => Effect.Effect<CreateEmailResponseSuccess, EmailError>;
}

/** Email service wrapping the Resend client. */
export class EmailService extends ServiceMap.Service<EmailService, EmailServiceShape>()(
	"EmailService",
) {}

/** Layer that provides EmailService. */
export const EmailServiceLive = Layer.effect(EmailService)(
	Effect.gen(function* () {
		const resendApiKey = yield* Config.redacted("RESEND_API_KEY");
		const resend = new Resend(Redacted.value(resendApiKey));
		yield* Effect.logInfo("EmailService initialized");

		return {
			send: (params: { from: string; to: string; subject: string; html: string; text: string }) =>
				Effect.gen(function* () {
					const result = yield* Effect.tryPromise({
						try: () => resend.emails.send(params),
						catch: () => new EmailError({ message: "Resend API request failed" }),
					});
					// Resend never throws — API errors are returned as { data: null, error: {...} }
					if (result.error || !result.data) {
						return yield* new EmailError({
							message: result.error?.message ?? "Email sent but received no response data",
						});
					}
					return result.data;
				}),
		};
	}),
);
