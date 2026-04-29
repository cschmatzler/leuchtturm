import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalSection } from "@leuchtturm/web/pages/-components/legal-page";

export const Route = createFileRoute("/privacy-policy")({
	component: Page,
});

function Page() {
	return (
		<LegalPage
			title="Privacy Policy"
			description={
				<>
					This Privacy Policy explains how Leuchtturm ("we", "us", or "our") collects, uses, and
					protects your personal data when you use our service. We are based in Germany and process
					data under the GDPR.
				</>
			}
		>
			<section className="flex flex-col gap-2">
				<h2 className="text-xl font-semibold">Information we collect</h2>
				<ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
					<li>Account details such as name, email address, and hashed passwords.</li>
					<li>Content you add to the product, including account settings.</li>
					<li>Usage and device data, such as logins, pages viewed, and browser type.</li>
					<li>Support requests and communications you send to us.</li>
				</ul>
			</section>
			<section className="flex flex-col gap-2">
				<h2 className="text-xl font-semibold">How we use your data</h2>
				<ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
					<li>Provide, secure, and maintain the service.</li>
					<li>Authenticate access and personalize your experience.</li>
					<li>Analyze product usage to improve features and reliability.</li>
					<li>Comply with legal obligations and prevent abuse.</li>
				</ul>
			</section>
			<LegalSection title="Legal bases">
				We process your data based on contract performance, legitimate interests in operating and
				improving the service, and consent where required.
			</LegalSection>
			<section className="flex flex-col gap-2">
				<h2 className="text-xl font-semibold">Subprocessors and sharing</h2>
				<p className="leading-relaxed text-muted-foreground">
					We do not sell your personal data. We share data with trusted subprocessors who help
					operate the service, including:
				</p>
				<ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
					<li>Hetzner for hosting and infrastructure in the EU.</li>
					<li>Cloudflare for transactional email delivery.</li>
					<li>Autumn for billing infrastructure.</li>
					<li>Stripe for payment processing.</li>
				</ul>
				<p className="leading-relaxed text-muted-foreground">
					We currently offer the service for free and do not collect payment details.
				</p>
			</section>
			<LegalSection title="International transfers">
				We store data primarily in Germany and the EU. If data is transferred outside the EU, we
				rely on appropriate safeguards such as standard contractual clauses.
			</LegalSection>
			<LegalSection title="Retention">
				We retain personal data while your account is active and as needed for legitimate business
				or legal purposes. You can request deletion at any time.
			</LegalSection>
			<LegalSection title="Your rights">
				You have rights to access, correct, delete, restrict, or object to processing, and to data
				portability. You may also lodge a complaint with your local supervisory authority.
			</LegalSection>
			<LegalSection title="Security">
				We use industry-standard security measures to protect your information, including encryption
				in transit and access controls.
			</LegalSection>
			<LegalSection title="Contact">
				If you have questions about this policy or your data, contact us at{" "}
				<a
					href="mailto:christoph@schmatzler.com"
					className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
				>
					christoph@schmatzler.com
				</a>
				.
			</LegalSection>
		</LegalPage>
	);
}
