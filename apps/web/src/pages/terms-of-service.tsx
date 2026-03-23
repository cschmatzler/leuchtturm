import { createFileRoute } from "@tanstack/react-router";

import { MarketingHeader } from "@chevrotain/web/components/app/marketing-header";

export const Route = createFileRoute("/terms-of-service")({
	component: Page,
});

function Page() {
	return (
		<div className="flex min-h-svh w-full flex-col bg-background">
			<MarketingHeader />
			<main className="flex flex-1 items-start justify-center px-6 py-12">
				<article className="flex w-full max-w-3xl flex-col gap-10">
					<header className="flex flex-col gap-3 border-b border-border pb-8">
						<h1 className="font-display text-4xl font-bold tracking-tight">Terms of Service</h1>
						<p className="text-sm text-muted-foreground">Last updated: Jan 24, 2026</p>
						<p className="mt-2 text-muted-foreground leading-relaxed">
							These Terms of Service ("Terms") govern your use of Chevrotain. By accessing or using
							the service, you agree to these Terms.
						</p>
					</header>
					<section className="flex flex-col gap-3">
						<h2 className="font-display text-2xl font-semibold">Use of the service</h2>
						<p className="text-muted-foreground leading-relaxed">
							You may use the service for personal or internal business purposes. You agree not to
							misuse the service, attempt unauthorized access, or interfere with its operation.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="font-display text-2xl font-semibold">Accounts</h2>
						<p className="text-muted-foreground leading-relaxed">
							You are responsible for keeping your login credentials secure and for all activity
							under your account. Provide accurate information and keep it up to date.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="font-display text-2xl font-semibold">Your content</h2>
						<p className="text-muted-foreground leading-relaxed">
							You retain ownership of the content you create. You grant us a limited license to
							host, process, and display it to provide the service.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="font-display text-2xl font-semibold">Availability and changes</h2>
						<p className="text-muted-foreground leading-relaxed">
							We work to keep the service available, but it may be interrupted for maintenance or
							updates. We may change or discontinue features with reasonable notice.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="font-display text-2xl font-semibold">Termination</h2>
						<p className="text-muted-foreground leading-relaxed">
							You may stop using the service at any time. We may suspend or terminate access if you
							violate these Terms or use the service in a harmful way.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="font-display text-2xl font-semibold">Disclaimer and liability</h2>
						<p className="text-muted-foreground leading-relaxed">
							The service is provided "as is" without warranties of any kind. To the extent allowed
							by law, we are not liable for indirect or consequential damages.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="font-display text-2xl font-semibold">Governing law</h2>
						<p className="text-muted-foreground leading-relaxed">
							These Terms are governed by the laws of Germany, without regard to conflict of law
							principles.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="font-display text-2xl font-semibold">Changes to these terms</h2>
						<p className="text-muted-foreground leading-relaxed">
							We may update these Terms from time to time. Material changes will be communicated in
							the product or on our website.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="font-display text-2xl font-semibold">Contact</h2>
						<p className="text-muted-foreground leading-relaxed">
							If you have questions about these Terms, contact us at{" "}
							<a
								href="mailto:christoph@schmatzler.com"
								className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
							>
								christoph@schmatzler.com
							</a>
							.
						</p>
					</section>
				</article>
			</main>
		</div>
	);
}
