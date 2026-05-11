import { Button, Heading, Hr, Link, Text } from "@react-email/components";
import { render } from "@react-email/render";
import * as Effect from "effect/Effect";

import { EmailRenderError, type EmailSender } from "@leuchtturm/email/shared";
import { defaultFrom, EmailFrame } from "@leuchtturm/email/templates/email-frame";

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
			<Heading className="m-0 mb-3 text-2xl font-semibold tracking-tight text-foreground">
				Sign in to Leuchtturm
			</Heading>
			<Text className="m-0 mb-5 text-sm leading-relaxed text-muted-foreground">
				Use this secure link to sign in to your Leuchtturm account.
			</Text>
			<Button
				href={signInUrl}
				className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground no-underline"
			>
				Sign in
			</Button>
			<Hr className="my-6 border-border" />
			<Text className="m-0 text-xs leading-relaxed text-muted-foreground">
				If the button does not work, paste this link into your browser:
			</Text>
			<Link href={signInUrl} className="break-all text-xs font-medium text-primary underline">
				{signInUrl}
			</Link>
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
	readonly send: EmailSender<Success, SendError>;
	readonly from?: string;
	readonly subject?: string;
}): Effect.Effect<void, SendError | EmailRenderError> {
	return Effect.gen(function* () {
		const { html, text } = yield* Effect.tryPromise({
			try: () => renderMagicLinkEmail({ signInUrl: params.signInUrl }),
			catch: () => new EmailRenderError({ template: "magic-link" }),
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
