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

const preheaderText = "Reset your Sixth Coffee password.";

const PasswordResetEmail = ({ resetUrl, userName }: { resetUrl: string; userName: string }) => {
	return (
		<Html lang="en">
			<Tailwind config={tailwindConfig}>
				<Preview>{preheaderText}</Preview>
				<Body className="bg-background font-sans text-foreground">
					<Container className="mx-auto w-full max-w-[560px] px-4 py-10">
						<Section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
							<Section className="border-b border-border px-6 py-5">
								<Text className="m-0 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
									Sixth Coffee
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
									We received a request to reset the password on your Sixth Coffee account. Use the
									button below to set a new chevrotain.
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

export async function renderPasswordResetEmail({
	resetUrl,
	userName,
}: {
	resetUrl: string;
	userName: string;
}) {
	const html = await render(<PasswordResetEmail resetUrl={resetUrl} userName={userName} />, {
		pretty: false,
	});

	const text = [
		"Reset your Sixth Coffee password.",
		"",
		"Use this link to choose a new password:",
		resetUrl,
		"",
		"If you did not request this, you can ignore this email.",
	].join("\n");

	return { html, text };
}
