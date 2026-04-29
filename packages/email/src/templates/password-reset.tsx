import { Button, Heading, Hr, Link, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { Effect } from "effect";

import { EmailRenderError, type EmailSender } from "@leuchtturm/email/shared";
import { defaultFrom, EmailFrame } from "@leuchtturm/email/templates/email-frame";

const preheaderText = "Reset your Leuchtturm password.";
const defaultSubject = "Reset your Leuchtturm password";

export interface PasswordResetEmailParams {
	readonly resetUrl: string;
	readonly userName: string;
}

const PasswordResetEmail = ({ resetUrl, userName }: PasswordResetEmailParams) => {
	return (
		<EmailFrame
			preheader={preheaderText}
			footer={
				<>
					If you did not request this, you can safely ignore this email. Your password will not
					change until you use the link above.
				</>
			}
		>
			<Heading className="m-0 mb-3 text-2xl font-semibold text-foreground">
				Reset your password
			</Heading>
			<Text className="m-0 mb-4 text-base leading-[24px] text-muted-foreground">
				Hi {userName},
			</Text>
			<Text className="m-0 mb-5 text-base leading-[24px] text-muted-foreground">
				We received a request to reset the password on your Leuchtturm account. Use the button below
				to set a new password.
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
			<Link href={resetUrl} className="break-all text-sm font-medium text-accent underline">
				{resetUrl}
			</Link>
		</EmailFrame>
	);
};

export async function renderPasswordResetEmail({ resetUrl, userName }: PasswordResetEmailParams) {
	const html = await render(<PasswordResetEmail resetUrl={resetUrl} userName={userName} />, {
		pretty: false,
	});

	const text = [
		"Reset your Leuchtturm password.",
		"",
		"Use this link to choose a new password:",
		resetUrl,
		"",
		"If you did not request this, you can ignore this email.",
	].join("\n");

	return { html, text };
}

export function sendPasswordResetEmail<Success, SendError>(params: {
	readonly email: string;
	readonly resetUrl: string;
	readonly userName: string;
	readonly send: EmailSender<Success, SendError>;
	readonly from?: string;
	readonly subject?: string;
}): Effect.Effect<void, SendError | EmailRenderError> {
	return Effect.gen(function* () {
		const { html, text } = yield* Effect.tryPromise({
			try: () => renderPasswordResetEmail({ resetUrl: params.resetUrl, userName: params.userName }),
			catch: () => new EmailRenderError({ template: "password reset" }),
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
