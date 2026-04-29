import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalSection } from "@leuchtturm/web/pages/-components/legal-page";

export const Route = createFileRoute("/terms-of-service")({
	component: Page,
});

function Page() {
	return (
		<LegalPage
			title="Terms of Service"
			description={
				<>
					These Terms of Service ("Terms") govern your use of Leuchtturm. By accessing or using the
					service, you agree to these Terms.
				</>
			}
		>
			<LegalSection title="Use of the service">
				You may use the service for personal or internal business purposes. You agree not to misuse
				the service, attempt unauthorized access, or interfere with its operation.
			</LegalSection>
			<LegalSection title="Accounts">
				You are responsible for keeping your login credentials secure and for all activity under
				your account. Provide accurate information and keep it up to date.
			</LegalSection>
			<LegalSection title="Your content">
				You retain ownership of the content you create. You grant us a limited license to host,
				process, and display it to provide the service.
			</LegalSection>
			<LegalSection title="Availability and changes">
				We work to keep the service available, but it may be interrupted for maintenance or updates.
				We may change or discontinue features with reasonable notice.
			</LegalSection>
			<LegalSection title="Termination">
				You may stop using the service at any time. We may suspend or terminate access if you
				violate these Terms or use the service in a harmful way.
			</LegalSection>
			<LegalSection title="Disclaimer and liability">
				The service is provided "as is" without warranties of any kind. To the extent allowed by
				law, we are not liable for indirect or consequential damages.
			</LegalSection>
			<LegalSection title="Governing law">
				These Terms are governed by the laws of Germany, without regard to conflict of law
				principles.
			</LegalSection>
			<LegalSection title="Changes to these terms">
				We may update these Terms from time to time. Material changes will be communicated in the
				product or on our website.
			</LegalSection>
			<LegalSection title="Contact">
				If you have questions about these Terms, contact us at{" "}
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
