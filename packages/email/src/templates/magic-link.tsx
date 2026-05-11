import { render } from "@react-email/render";
import * as Effect from "effect/Effect";

import { type Email } from "@leuchtturm/email";
import { type EmailRenderError } from "@leuchtturm/email/errors";
import { ActionEmailContent, sendRenderedEmail } from "@leuchtturm/email/templates/action-email";
import { EmailFrame } from "@leuchtturm/email/templates/email-frame";

const preheaderText = "Use this secure link to sign in to Leuchtturm.";
const defaultSubject = "Sign in to Leuchtturm";

export interface MagicLinkEmailParams {
	readonly signInUrl: string;
}

const MagicLinkEmail = ({ signInUrl }: MagicLinkEmailParams) => {
	return (
		<EmailFrame
			preheader={preheaderText}
			footer="If you did not request this sign-in link, you can safely ignore this email."
		>
			<ActionEmailContent
				heading="Sign in to Leuchtturm"
				body="Use this secure link to sign in to your Leuchtturm account."
				actionHref={signInUrl}
				actionLabel="Sign in"
			/>
		</EmailFrame>
	);
};

export async function renderMagicLinkEmail({ signInUrl }: MagicLinkEmailParams) {
	const html = await render(<MagicLinkEmail signInUrl={signInUrl} />, { pretty: false });

	const text = [
		"Sign in to Leuchtturm with this secure link:",
		signInUrl,
		"",
		"If you did not request this sign-in link, you can ignore this email.",
	].join("\n");

	return { html, text };
}

export function sendMagicLinkEmail<Success, SendError>(params: {
	readonly signInUrl: string;
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
		defaultSubject,
		template: "magic-link",
		render: () => renderMagicLinkEmail({ signInUrl: params.signInUrl }),
	});
}
