import { Button, Heading, Hr, Link, Text } from "@react-email/components";
import * as Effect from "effect/Effect";
import { type ReactNode } from "react";

import { type Email } from "@leuchtturm/email";
import { EmailRenderError } from "@leuchtturm/email/errors";
import { defaultFrom } from "@leuchtturm/email/templates/email-frame";

export interface ActionEmailContentProps {
	readonly heading: ReactNode;
	readonly body: ReactNode;
	readonly actionHref: string;
	readonly actionLabel: string;
}

export function ActionEmailContent(props: ActionEmailContentProps) {
	return (
		<>
			<Heading className="m-0 mb-3 text-2xl font-semibold tracking-tight text-foreground">
				{props.heading}
			</Heading>
			<Text className="m-0 mb-5 text-sm leading-relaxed text-muted-foreground">{props.body}</Text>
			<Button
				href={props.actionHref}
				className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground no-underline"
			>
				{props.actionLabel}
			</Button>
			<Hr className="my-6 border-border" />
			<Text className="m-0 text-xs leading-relaxed text-muted-foreground">
				If the button does not work, paste this link into your browser:
			</Text>
			<Link
				href={props.actionHref}
				className="break-all text-xs font-medium text-primary underline"
			>
				{props.actionHref}
			</Link>
		</>
	);
}

export function sendRenderedEmail<Success, SendError>(params: {
	readonly email: string;
	readonly send: Email.Sender<Success, SendError>;
	readonly subject?: string;
	readonly from?: string;
	readonly defaultSubject: string;
	readonly template: string;
	readonly render: () => Promise<{ readonly html: string; readonly text: string }>;
}): Effect.Effect<void, SendError | EmailRenderError> {
	return Effect.gen(function* () {
		const { html, text } = yield* Effect.tryPromise({
			try: params.render,
			catch: () => new EmailRenderError({ template: params.template }),
		});

		yield* params.send({
			from: params.from ?? defaultFrom,
			to: params.email,
			subject: params.subject ?? params.defaultSubject,
			html,
			text,
		});
	});
}
