import { createFileRoute } from "@tanstack/react-router";

import { MarketingHeader } from "@one/web/components/app/marketing-header";

export const Route = createFileRoute("/terms-of-service")({
	component: Page,
});

function Page() {
	return (
		<div className="flex min-h-svh w-full flex-col bg-background">
			<MarketingHeader />
			<main className="flex flex-1 items-center justify-center px-6 py-12">
				<div className="flex w-full max-w-3xl flex-col gap-8">
					<div className="flex flex-col gap-3">
						<h1 className="text-3xl font-semibold">Terms of Service</h1>
						<p className="text-muted-foreground">Last updated: Jan 24, 2026</p>
						<p className="text-muted-foreground">
							These Terms of Service ("Terms") govern your use of Sixth Coffee. By accessing or
							using the service, you agree to these Terms.
						</p>
					</div>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Use of the service</h2>
						<p className="text-muted-foreground">
							You may use the service for personal or internal business purposes. You agree not to
							misuse the service, attempt unauthorized access, or interfere with its operation.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Accounts</h2>
						<p className="text-muted-foreground">
							You are responsible for keeping your login credentials secure and for all activity
							under your account. Provide accurate information and keep it up to date.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Your content</h2>
						<p className="text-muted-foreground">
							You retain ownership of the content you create. You grant us a limited license to
							host, process, and display it to provide the service.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Availability and changes</h2>
						<p className="text-muted-foreground">
							We work to keep the service available, but it may be interrupted for maintenance or
							updates. We may change or discontinue features with reasonable notice.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Termination</h2>
						<p className="text-muted-foreground">
							You may stop using the service at any time. We may suspend or terminate access if you
							violate these Terms or use the service in a harmful way.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Disclaimer and liability</h2>
						<p className="text-muted-foreground">
							The service is provided "as is" without warranties of any kind. To the extent allowed
							by law, we are not liable for indirect or consequential damages.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Governing law</h2>
						<p className="text-muted-foreground">
							These Terms are governed by the laws of Germany, without regard to conflict of law
							principles.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Changes to these terms</h2>
						<p className="text-muted-foreground">
							We may update these Terms from time to time. Material changes will be communicated in
							the product or on our website.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Contact</h2>
						<p className="text-muted-foreground">
							If you have questions about these Terms, contact us at{" "}
							<a
								href="mailto:christoph@schmatzler.com"
								className="underline underline-offset-4 hover:text-foreground"
							>
								christoph@schmatzler.com
							</a>
							.
						</p>
					</section>
				</div>
			</main>
		</div>
	);
}
