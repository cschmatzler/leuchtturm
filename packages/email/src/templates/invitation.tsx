import * as Effect from "effect/Effect";
import { render } from "react-email";

import { type Email } from "@leuchtturm/email";
import { type EmailRenderError } from "@leuchtturm/email/errors";
import { ActionEmailContent, sendRenderedEmail } from "@leuchtturm/email/templates/action-email";
import { EmailFrame } from "@leuchtturm/email/templates/email-frame";

const preheaderText = "You have been invited to join a Leuchtturm organization.";
const defaultSubject = "You have been invited to Leuchtturm";

export interface InvitationEmailParams {
	readonly acceptUrl: string;
	readonly inviterName: string;
	readonly organizationName: string;
}

function InvitationEmail({ acceptUrl, inviterName, organizationName }: InvitationEmailParams) {
	return (
		<EmailFrame
			preheader={preheaderText}
			footer="If you did not expect this invitation, you can safely ignore this email."
		>
			<ActionEmailContent
				heading={`Join ${organizationName}`}
				body={`${inviterName} invited you to join ${organizationName} on Leuchtturm.`}
				actionHref={acceptUrl}
				actionLabel="Accept invitation"
			/>
		</EmailFrame>
	);
}

export async function renderInvitationEmail({
	acceptUrl,
	inviterName,
	organizationName,
}: InvitationEmailParams) {
	const html = await render(
		<InvitationEmail
			acceptUrl={acceptUrl}
			inviterName={inviterName}
			organizationName={organizationName}
		/>,
		{ pretty: false },
	);

	const text = [
		`You have been invited to join ${organizationName} on Leuchtturm.`,
		"",
		`${inviterName} invited you to join ${organizationName}.`,
		"",
		"Accept the invitation with this link:",
		acceptUrl,
		"",
		"If you did not expect this invitation, you can ignore this email.",
	].join("\n");

	return { html, text };
}

export function sendInvitationEmail<Success, SendError>(params: {
	readonly acceptUrl: string;
	readonly email: string;
	readonly inviterName: string;
	readonly organizationName: string;
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
		template: "invitation",
		render: () =>
			renderInvitationEmail({
				acceptUrl: params.acceptUrl,
				inviterName: params.inviterName,
				organizationName: params.organizationName,
			}),
	});
}
