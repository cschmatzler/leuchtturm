import {
	Body,
	Button,
	Container,
	Heading,
	Hr,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import { Tailwind } from "@react-email/tailwind";

import { tailwindConfig } from "@leuchtturm/email/tailwind";

const preheaderText = "You have been invited to join a Leuchtturm organization.";
const defaultFrom = "Leuchtturm <no-reply@leuchtturm.dev>";
const defaultSubject = "You have been invited to Leuchtturm";

export interface InvitationEmailParams {
	readonly acceptUrl: string;
	readonly inviterName: string;
	readonly organizationName: string;
}

export interface InvitationEmailSendParams {
	readonly from: string;
	readonly to: string;
	readonly subject: string;
	readonly html: string;
	readonly text: string;
}

const InvitationEmail = ({ acceptUrl, inviterName, organizationName }: InvitationEmailParams) => {
	return (
		<Html lang="en">
			<Tailwind config={tailwindConfig}>
				<Preview>{preheaderText}</Preview>
				<Body className="bg-background font-sans text-foreground">
					<Container className="mx-auto w-full max-w-[560px] px-4 py-10">
						<Section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
							<Section className="border-b border-border px-6 py-5">
								<Text className="m-0 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
									Leuchtturm
								</Text>
							</Section>
							<Section className="px-6 py-6">
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
								<Link
									href={acceptUrl}
									className="break-all text-sm font-medium text-accent underline"
								>
									{acceptUrl}
								</Link>
							</Section>
							<Section className="border-t border-border px-6 py-5">
								<Text className="m-0 text-xs leading-[18px] text-muted-foreground">
									If you did not expect this invitation, you can safely ignore this email.
								</Text>
							</Section>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
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

export async function sendInvitationEmail({
	acceptUrl,
	email,
	from = defaultFrom,
	inviterName,
	organizationName,
	send,
	subject = defaultSubject,
}: InvitationEmailParams & {
	readonly email: string;
	readonly from?: string;
	readonly send: (params: InvitationEmailSendParams) => Promise<unknown>;
	readonly subject?: string;
}) {
	const { html, text } = await renderInvitationEmail({
		acceptUrl,
		inviterName,
		organizationName,
	});

	await send({
		from,
		to: email,
		subject,
		html,
		text,
	});
}
