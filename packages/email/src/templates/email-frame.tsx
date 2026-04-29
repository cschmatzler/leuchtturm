import { Body, Container, Html, Preview, Section, Text } from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import { type ReactNode } from "react";

import { tailwindConfig } from "@leuchtturm/email/tailwind";

export const defaultFrom = "Leuchtturm <no-reply@mail.leuchtturm.dev>";

export function EmailFrame(props: {
	readonly preheader: string;
	readonly footer: ReactNode;
	readonly children: ReactNode;
}) {
	return (
		<Html lang="en">
			<Tailwind config={tailwindConfig}>
				<Preview>{props.preheader}</Preview>
				<Body className="bg-background font-sans text-foreground">
					<Container className="mx-auto w-full max-w-[560px] px-4 py-10">
						<Section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
							<Section className="border-b border-border px-6 py-5">
								<Text className="m-0 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
									Leuchtturm
								</Text>
							</Section>
							<Section className="px-6 py-6">{props.children}</Section>
							<Section className="border-t border-border px-6 py-5">
								<Text className="m-0 text-xs leading-[18px] text-muted-foreground">
									{props.footer}
								</Text>
							</Section>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}
