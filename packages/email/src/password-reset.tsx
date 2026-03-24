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

import { tailwindConfig } from "@chevrotain/email/tailwind";

const preheaderText = "Reset your Chevrotain password.";
const defaultFrom = "Chevrotain <no-reply@chevrotain.schmatzler.com>";
const defaultSubject = "Reset your Chevrotain password";

export interface PasswordResetEmailParams {
	readonly resetUrl: string;
	readonly userName: string;
}

export interface PasswordResetEmailSendParams {
	readonly from: string;
	readonly to: string;
	readonly subject: string;
	readonly html: string;
	readonly text: string;
}

const PasswordResetEmail = ({ resetUrl, userName }: PasswordResetEmailParams) => {
	return (
		<Html lang="en">
			<Tailwind config={tailwindConfig}>
				<Preview>{preheaderText}</Preview>
				<Body className="bg-background font-sans text-foreground">
					<Container className="mx-auto w-full max-w-[560px] px-4 py-10">
						<Section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
							<Section className="border-b border-border px-6 py-5">
								<Text className="m-0 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
									Chevrotain
								</Text>
							</Section>
							<Section className="px-6 py-6">
								<Heading className="m-0 mb-3 text-2xl font-semibold text-foreground">
									Reset your password
								</Heading>
								<Text className="m-0 mb-4 text-base leading-[24px] text-muted-foreground">
									Hi {userName},
								</Text>
								<Text className="m-0 mb-5 text-base leading-[24px] text-muted-foreground">
									We received a request to reset the password on your Chevrotain account. Use the
									button below to set a new password.
								</Text>
								<Button
									href={resetUrl}
									className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground no-underline"
								>
									Reset password
								</Button>
								<Hr className="my-6 border-border" />
								<Text className="m-0 text-sm leading-[20px] text-muted-foreground">
									If the button does not work, paste this link into your browser:
								</Text>
								<Link
									href={resetUrl}
									className="break-all text-sm font-medium text-accent underline"
								>
									{resetUrl}
								</Link>
							</Section>
							<Section className="border-t border-border px-6 py-5">
								<Text className="m-0 text-xs leading-[18px] text-muted-foreground">
									If you did not request this, you can safely ignore this email. Your password will
									not change until you use the link above.
								</Text>
							</Section>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export async function renderPasswordResetEmail({ resetUrl, userName }: PasswordResetEmailParams) {
	const html = await render(<PasswordResetEmail resetUrl={resetUrl} userName={userName} />, {
		pretty: false,
	});

	const text = [
		"Reset your Chevrotain password.",
		"",
		"Use this link to choose a new password:",
		resetUrl,
		"",
		"If you did not request this, you can ignore this email.",
	].join("\n");

	return { html, text };
}

export async function sendPasswordResetEmail({
	email,
	from = defaultFrom,
	resetUrl,
	send,
	subject = defaultSubject,
	userName,
}: PasswordResetEmailParams & {
	readonly email: string;
	readonly from?: string;
	readonly send: (params: PasswordResetEmailSendParams) => Promise<unknown>;
	readonly subject?: string;
}) {
	const { html, text } = await renderPasswordResetEmail({ resetUrl, userName });

	await send({
		from,
		to: email,
		subject,
		html,
		text,
	});
}
