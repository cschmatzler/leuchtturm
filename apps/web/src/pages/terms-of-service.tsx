import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { MarketingHeader } from "@chevrotain/web/components/app/marketing-header";

export const Route = createFileRoute("/terms-of-service")({
	component: Page,
});

function Page() {
	return (
		<div className="flex min-h-svh w-full flex-col bg-background">
			<MarketingHeader />
			<main className="flex flex-1 justify-center px-6 py-16 md:py-24">
				<article className="flex w-full max-w-2xl flex-col gap-10">
					<header className="flex flex-col gap-3 border-b border-border pb-8">
						<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
							Legal
						</p>
						<h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
						<p className="text-sm text-muted-foreground">Last updated: Jan 24, 2026</p>
						<p className="mt-1 leading-relaxed text-muted-foreground">
							These Terms of Service ("Terms") govern your use of Chevrotain. By accessing or using
							the service, you agree to these Terms.
						</p>
					</header>
					<Section title="Use of the service">
						You may use the service for personal or internal business purposes. You agree not to
						misuse the service, attempt unauthorized access, or interfere with its operation.
					</Section>
					<Section title="Accounts">
						You are responsible for keeping your login credentials secure and for all activity under
						your account. Provide accurate information and keep it up to date.
					</Section>
					<Section title="Your content">
						You retain ownership of the content you create. You grant us a limited license to host,
						process, and display it to provide the service.
					</Section>
					<Section title="Availability and changes">
						We work to keep the service available, but it may be interrupted for maintenance or
						updates. We may change or discontinue features with reasonable notice.
					</Section>
					<Section title="Termination">
						You may stop using the service at any time. We may suspend or terminate access if you
						violate these Terms or use the service in a harmful way.
					</Section>
					<Section title="Disclaimer and liability">
						The service is provided "as is" without warranties of any kind. To the extent allowed by
						law, we are not liable for indirect or consequential damages.
					</Section>
					<Section title="Governing law">
						These Terms are governed by the laws of Germany, without regard to conflict of law
						principles.
					</Section>
					<Section title="Changes to these terms">
						We may update these Terms from time to time. Material changes will be communicated in
						the product or on our website.
					</Section>
					<Section title="Contact">
						If you have questions about these Terms, contact us at{" "}
						<a
							href="mailto:christoph@schmatzler.com"
							className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
						>
							christoph@schmatzler.com
						</a>
						.
					</Section>
				</article>
			</main>
		</div>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-2">
			<h2 className="text-xl font-semibold">{title}</h2>
			<p className="leading-relaxed text-muted-foreground">{children}</p>
		</section>
	);
}
