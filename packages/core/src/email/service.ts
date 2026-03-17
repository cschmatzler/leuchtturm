import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";
import { Resend } from "resend";
import type { CreateEmailResponse } from "resend";

import { EmailError } from "@one/core/errors";

export interface EmailServiceShape {
	readonly send: (params: {
		from: string;
		to: string;
		subject: string;
		html: string;
		text: string;
	}) => Effect.Effect<CreateEmailResponse, EmailError>;
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

		return {
			send: (params: { from: string; to: string; subject: string; html: string; text: string }) =>
				Effect.tryPromise({
					try: () => resend.emails.send(params),
					catch: (cause) => new EmailError({ cause }),
				}),
		};
	}),
);
