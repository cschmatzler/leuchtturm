import { Button, Heading, Hr, Link, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { Effect } from "effect";

import { EmailRenderError, type EmailSender } from "@leuchtturm/email/shared";
import { defaultFrom, EmailFrame } from "@leuchtturm/email/templates/email-frame";

const preheaderText = "You have been invited to join a Leuchtturm organization.";
const defaultSubject = "You have been invited to Leuchtturm";

export interface InvitationEmailParams {
	readonly acceptUrl: string;
	readonly inviterName: string;
	readonly organizationName: string;
}

const InvitationEmail = ({ acceptUrl, inviterName, organizationName }: InvitationEmailParams) => {
	return (
		<EmailFrame
			preheader={preheaderText}
			footer="If you did not expect this invitation, you can safely ignore this email."
		>
			<Heading className="m-0 mb-3 text-2xl font-semibold text-foreground">
				Join {organizationName}
			</Heading>
			<Text className="m-0 mb-5 text-base leading-[24px] text-muted-foreground">
				{inviterName} invited you to join {organizationName} on Leuchtturm.
			</Text>
			<Button
				href={acceptUrl}
				className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground no-underline"
			>
				Accept invitation
			</Button>
			<Hr className="my-6 border-border" />
			<Text className="m-0 text-sm leading-[20px] text-muted-foreground">
				If the button does not work, paste this link into your browser:
			</Text>
			<Link href={acceptUrl} className="break-all text-sm font-medium text-accent underline">
				{acceptUrl}
			</Link>
		</EmailFrame>
	);
};

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
	readonly send: EmailSender<Success, SendError>;
	readonly from?: string;
	readonly subject?: string;
}): Effect.Effect<void, SendError | EmailRenderError> {
	return Effect.gen(function* () {
		const { html, text } = yield* Effect.tryPromise({
			try: () =>
				renderInvitationEmail({
					acceptUrl: params.acceptUrl,
					inviterName: params.inviterName,
					organizationName: params.organizationName,
				}),
			catch: () => new EmailRenderError({ template: "invitation" }),
		});

		yield* params.send({
			from: params.from ?? defaultFrom,
			to: params.email,
			subject: params.subject ?? defaultSubject,
			html,
			text,
		});
	});
}
