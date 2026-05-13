import * as Effect from "effect/Effect";
import { render } from "react-email";

import { type Email } from "@leuchtturm/email";
import { type EmailRenderError } from "@leuchtturm/email/errors";
import { ActionEmailContent, sendRenderedEmail } from "@leuchtturm/email/templates/action-email";
import { EmailFrame } from "@leuchtturm/email/templates/email-frame";

export interface EmailVerificationEmailParams {
	readonly verificationUrl: string;
}

function EmailVerificationEmail({ verificationUrl }: EmailVerificationEmailParams) {
	return (
		<EmailFrame
			preheader="Verify your Leuchtturm email address."
			footer="If you did not create a Leuchtturm account, you can safely ignore this email."
		>
			<ActionEmailContent
				heading="Verify your email address"
				body="Confirm this email address to finish setting up your Leuchtturm account."
				actionHref={verificationUrl}
				actionLabel="Verify email address"
			/>
		</EmailFrame>
	);
}

export async function renderEmailVerificationEmail({
	verificationUrl,
}: EmailVerificationEmailParams) {
	const html = await render(<EmailVerificationEmail verificationUrl={verificationUrl} />, {
		pretty: false,
	});

	const text = [
		"Verify your Leuchtturm email address.",
		"",
		"Confirm this email address to finish setting up your Leuchtturm account:",
		verificationUrl,
		"",
		"If you did not create a Leuchtturm account, you can ignore this email.",
	].join("\n");

	return { html, text };
}

export function sendEmailVerificationEmail<Success, SendError>(params: {
	readonly verificationUrl: string;
	readonly email: string;
	readonly send: Email.Sender<Success, SendError>;
	readonly from?: string;
	readonly subject?: string;
}): Effect.Effect<void, SendError | EmailRenderError> {
	return sendRenderedEmail({
		email: params.email,
		from: params.from,
		send: params.send,
		subject: params.subject,
		defaultSubject: "Verify your Leuchtturm email address",
		template: "email-verification",
		render: () =>
			renderEmailVerificationEmail({
				verificationUrl: params.verificationUrl,
			}),
	});
}
