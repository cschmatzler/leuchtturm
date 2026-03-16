import { createFileRoute } from "@tanstack/react-router";

import { MarketingHeader } from "@roasted/web/components/app/marketing-header";

export const Route = createFileRoute("/privacy-policy")({
	component: Page,
});

function Page() {
	return (
		<div className="flex min-h-svh w-full flex-col bg-background">
			<MarketingHeader />
			<main className="flex flex-1 items-center justify-center px-6 py-12">
				<div className="flex w-full max-w-3xl flex-col gap-8">
					<div className="flex flex-col gap-3">
						<h1 className="text-3xl font-semibold">Privacy Policy</h1>
						<p className="text-muted-foreground">Last updated: Jan 24, 2026</p>
						<p className="text-muted-foreground">
							This Privacy Policy explains how Sixth Coffee ("we", "us", or "our") collects, uses,
							and protects your personal data when you use our service. We are based in Germany and
							process data under the GDPR.
						</p>
					</div>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Information we collect</h2>
						<ul className="text-muted-foreground list-disc space-y-2 pl-5">
							<li>Account details such as name, email address, and hashed passwords.</li>
							<li>Content you add to the product, including brew notes and coffee inventory.</li>
							<li>Usage and device data, such as logins, pages viewed, and browser type.</li>
							<li>Support requests and communications you send to us.</li>
						</ul>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">How we use your data</h2>
						<ul className="text-muted-foreground list-disc space-y-2 pl-5">
							<li>Provide, secure, and maintain the service.</li>
							<li>Authenticate access and personalize your experience.</li>
							<li>Analyze product usage to improve features and reliability.</li>
							<li>Comply with legal obligations and prevent abuse.</li>
						</ul>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Legal bases</h2>
						<p className="text-muted-foreground">
							We process your data based on contract performance, legitimate interests in operating
							and improving the service, and consent where required.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Subprocessors and sharing</h2>
						<p className="text-muted-foreground">
							We do not sell your personal data. We share data with trusted subprocessors who help
							operate the service, including:
						</p>
						<ul className="text-muted-foreground list-disc space-y-2 pl-5">
							<li>Hetzner for hosting and infrastructure in the EU.</li>
							<li>Resend for transactional email delivery.</li>
							<li>Autumn for billing infrastructure.</li>
							<li>Stripe for payment processing.</li>
						</ul>
						<p className="text-muted-foreground">
							We currently offer the service for free and do not collect payment details.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">International transfers</h2>
						<p className="text-muted-foreground">
							We store data primarily in Germany and the EU. If data is transferred outside the EU,
							we rely on appropriate safeguards such as standard contractual clauses.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Retention</h2>
						<p className="text-muted-foreground">
							We retain personal data while your account is active and as needed for legitimate
							business or legal purposes. You can request deletion at any time.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Your rights</h2>
						<p className="text-muted-foreground">
							You have rights to access, correct, delete, restrict, or object to processing, and to
							data portability. You may also lodge a complaint with your local supervisory
							authority.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Security</h2>
						<p className="text-muted-foreground">
							We use industry-standard security measures to protect your information, including
							encryption in transit and access controls.
						</p>
					</section>
					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Contact</h2>
						<p className="text-muted-foreground">
							If you have questions about this policy or your data, contact us at{" "}
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
